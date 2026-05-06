using Kartenreihen.Api.Contracts;
using Kartenreihen.Api.Hubs;
using Kartenreihen.Game;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Kartenreihen.Api.Services;

public sealed class GameSessionService(
    IHubContext<GameHub> hubContext,
    IOptions<GameOptions> options,
    ILogger<GameSessionService> logger)
{
    private readonly object _syncRoot = new();
    private readonly string _adminCode = options.Value.AdminCode;
    private readonly TimeSpan _aiMoveDelay = TimeSpan.FromMilliseconds(Math.Max(1, options.Value.AiMoveDelayMilliseconds));
    private readonly Random _random = new();
    private readonly SimpleAiStrategy _aiStrategy = new();
    private readonly List<HumanPlayerSession> _humanPlayers = [];
    private readonly HashSet<string> _adminTokens = new(StringComparer.Ordinal);
    private readonly ILogger<GameSessionService> _logger = logger;
    private MatchState? _match;
    private int _nextAiNumber = 1;
    private bool _isAiAdvanceLoopRunning;

    public async Task<SessionResponse> JoinPlayerAsync(string name)
    {
        var trimmedName = name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmedName))
        {
            throw new InvalidOperationException("Bitte einen Namen eingeben.");
        }

        SessionResponse response;
        lock (_syncRoot)
        {
            if (_humanPlayers.Any(player => string.Equals(player.Name, trimmedName, StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException("Dieser Spielername ist bereits vergeben.");
            }

            if (_match?.Status == MatchStatus.Active)
            {
                throw new InvalidOperationException("Waehren einer laufenden Partie koennen keine neuen Spieler beitreten.");
            }

            var session = new HumanPlayerSession(
                Guid.NewGuid().ToString("N"),
                trimmedName,
                Guid.NewGuid().ToString("N"));

            _humanPlayers.Add(session);
            response = new SessionResponse(session.Token, BuildPlayerSnapshotLocked(session));
        }

        await NotifyStateChangedAsync();
        return response;
    }

    public SessionResponse RestorePlayerSession(string token)
    {
        lock (_syncRoot)
        {
            var session = GetHumanPlayerSession(token);
            return new SessionResponse(token, BuildPlayerSnapshotLocked(session));
        }
    }

    public async Task<SessionResponse> LoginAdminAsync(string code)
    {
        if (!string.Equals(code, _adminCode, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Der Admin-Code ist ungueltig.");
        }

        SessionResponse response;
        lock (_syncRoot)
        {
            var token = Guid.NewGuid().ToString("N");
            _adminTokens.Add(token);
            response = new SessionResponse(token, BuildAdminSnapshotLocked(token));
        }

        await NotifyStateChangedAsync();
        return response;
    }

    public SessionResponse RestoreAdminSession(string token)
    {
        lock (_syncRoot)
        {
            EnsureAdminToken(token);
            return new SessionResponse(token, BuildAdminSnapshotLocked(token));
        }
    }

    public async Task<GameSnapshot> StartGameAsync(string adminToken, int targetPlayerCount, int? roundLimit)
    {
        GameSnapshot snapshot;
        lock (_syncRoot)
        {
            EnsureAdminToken(adminToken);

            if (targetPlayerCount is not 3 and not 4)
            {
                throw new InvalidOperationException("Eine Partie kann nur mit 3 oder 4 Spielern gestartet werden.");
            }

            if (roundLimit is <= 0)
            {
                throw new InvalidOperationException("Die Rundenzahl muss mindestens 1 betragen.");
            }

            if (_match?.Status == MatchStatus.Active)
            {
                throw new InvalidOperationException("Es laeuft bereits eine Partie.");
            }

            if (_humanPlayers.Count == 0)
            {
                throw new InvalidOperationException("Mindestens ein realer Spieler muss beigetreten sein.");
            }

            if (_humanPlayers.Count > targetPlayerCount)
            {
                throw new InvalidOperationException("Es sind mehr reale Spieler in der Lobby als fuer diese Partie erlaubt.");
            }

            StartMatchLocked(targetPlayerCount, roundLimit);

            snapshot = BuildAdminSnapshotLocked(adminToken);
        }

        await NotifyStateChangedAsync();
        EnsureAiAdvanceLoopRunning();
        return snapshot;
    }

    public async Task<GameSnapshot> EndGameAsync(string adminToken)
    {
        GameSnapshot snapshot;
        lock (_syncRoot)
        {
            EnsureAdminToken(adminToken);

            if (_match?.Status != MatchStatus.Active)
            {
                throw new InvalidOperationException("Es gibt keine aktive Partie zum Beenden.");
            }

            _match.Status = MatchStatus.Completed;
            snapshot = BuildAdminSnapshotLocked(adminToken);
        }

        await NotifyStateChangedAsync();
        return snapshot;
    }

    public async Task<GameSnapshot> VoteForAnotherRoundAsync(string playerToken, bool wantsAnotherRound)
    {
        GameSnapshot snapshot;
        var shouldEnsureAiLoop = false;

        lock (_syncRoot)
        {
            var playerSession = GetHumanPlayerSession(playerToken);
            var match = _match;

            if (match?.Status != MatchStatus.Completed || !match.CompletedBecauseRoundLimit)
            {
                throw new InvalidOperationException("Aktuell kann keine weitere Partie bestaetigt werden.");
            }

            var player = match.Players.SingleOrDefault(candidate => candidate.Id == playerSession.PlayerId && candidate.Kind == ParticipantKind.Human)
                ?? throw new InvalidOperationException("Dieser Spieler kann fuer keine weitere Partie abstimmen.");

            match.RematchPreferences[player.Id] = wantsAnotherRound;

            if (AllHumanPlayersWantAnotherRoundLocked(match))
            {
                StartAnotherRoundLocked(match);
                shouldEnsureAiLoop = true;
            }

            snapshot = BuildPlayerSnapshotLocked(playerSession);
        }

        await NotifyStateChangedAsync();

        if (shouldEnsureAiLoop)
        {
            EnsureAiAdvanceLoopRunning();
        }

        return snapshot;
    }

    public async Task<ResetGameResponse> ResetAsync(string adminToken)
    {
        lock (_syncRoot)
        {
            EnsureAdminToken(adminToken);
            _humanPlayers.Clear();
            _adminTokens.Clear();
            _match = null;
            _nextAiNumber = 1;
        }

        await NotifyResetAsync();
        return new ResetGameResponse(true);
    }

    public async Task<GameSnapshot> PlayCardsAsync(string playerToken, IReadOnlyList<Card> cards)
    {
        GameSnapshot snapshot;
        lock (_syncRoot)
        {
            var playerSession = GetHumanPlayerSession(playerToken);
            var player = GetActivePlayerSlot(playerSession.PlayerId);
            var round = GetActiveRound();

            GameEngine.ApplyPlay(round, _match!.Players, player, cards);
            snapshot = BuildPlayerSnapshotLocked(playerSession);
        }

        await NotifyStateChangedAsync();
        EnsureAiAdvanceLoopRunning();
        return snapshot;
    }

    public async Task<GameSnapshot> PassAsync(string playerToken)
    {
        GameSnapshot snapshot;
        lock (_syncRoot)
        {
            var playerSession = GetHumanPlayerSession(playerToken);
            var player = GetActivePlayerSlot(playerSession.PlayerId);
            var round = GetActiveRound();

            GameEngine.ApplyPass(round, _match!.Players, player);
            snapshot = BuildPlayerSnapshotLocked(playerSession);
        }

        await NotifyStateChangedAsync();
        EnsureAiAdvanceLoopRunning();
        return snapshot;
    }

    private void EnsureAiAdvanceLoopRunning()
    {
        lock (_syncRoot)
        {
            if (_isAiAdvanceLoopRunning || !CanAdvanceAutomaticallyLocked())
            {
                return;
            }

            _isAiAdvanceLoopRunning = true;
        }

        _ = Task.Run(RunAiAdvanceLoopAsync);
    }

    private async Task RunAiAdvanceLoopAsync()
    {
        try
        {
            while (true)
            {
                lock (_syncRoot)
                {
                    if (!CanAdvanceAutomaticallyLocked())
                    {
                        _isAiAdvanceLoopRunning = false;
                        return;
                    }
                }

                await Task.Delay(_aiMoveDelay);

                lock (_syncRoot)
                {
                    if (!AdvanceAutomaticStepLocked())
                    {
                        _isAiAdvanceLoopRunning = false;
                        return;
                    }
                }

                await NotifyStateChangedAsync();
            }
        }
        catch (Exception exception)
        {
            lock (_syncRoot)
            {
                _isAiAdvanceLoopRunning = false;
            }

            _logger.LogError(exception, "Automatische KI-Zuege konnten nicht abgeschlossen werden.");
        }
    }

    private bool CanAdvanceAutomaticallyLocked()
    {
        if (_match?.Status != MatchStatus.Active)
        {
            return false;
        }

        var round = _match.CurrentRound;
        if (round is null)
        {
            return false;
        }

        if (round.Phase == RoundPhase.Completed)
        {
            return true;
        }

        return round.CurrentPlayerIndex.HasValue &&
               _match.Players[round.CurrentPlayerIndex.Value].Kind == ParticipantKind.Ai;
    }

    private bool AdvanceAutomaticStepLocked()
    {
        if (_match?.Status != MatchStatus.Active)
        {
            return false;
        }

        var round = _match.CurrentRound ?? throw new InvalidOperationException("Es existiert keine aktuelle Runde.");

        if (round.Phase == RoundPhase.Completed)
        {
            var roundScores = BuildRoundScores(round, _match.Players);
            var winner = _match.Players.Single(player => player.Id == round.WinnerPlayerId);
            _match.Results.Add(new RoundResult(
                round.Number,
                winner.Id,
                winner.Name,
                round.StartRank ?? CardRank.Six,
                round.ChooserIndex,
                roundScores));

            if (_match.RoundLimit.HasValue && _match.Results.Count >= _match.RoundLimit.Value)
            {
                _match.Status = MatchStatus.Completed;
                _match.CompletedBecauseRoundLimit = true;
                _match.CurrentRound = null;
                return true;
            }

            var nextChooser = GameEngine.ChooseRoundStarterIndex(_match.Players, roundScores, _random);
            _match.CurrentRound = GameEngine.CreateRound(_match.Players, round.Number + 1, nextChooser, _random);
            return true;
        }

        if (!round.CurrentPlayerIndex.HasValue)
        {
            return false;
        }

        var currentPlayer = _match.Players[round.CurrentPlayerIndex.Value];
        if (currentPlayer.Kind != ParticipantKind.Ai)
        {
            return false;
        }

        var decision = _aiStrategy.ChooseTurn(round, currentPlayer);
        if (decision.ShouldPass)
        {
            GameEngine.ApplyPass(round, _match.Players, currentPlayer);
            return true;
        }

        GameEngine.ApplyPlay(round, _match.Players, currentPlayer, decision.Cards);
        return true;
    }

    private void StartMatchLocked(int targetPlayerCount, int? roundLimit)
    {
        var players = _humanPlayers
            .Select(player => new PlayerSlot(player.PlayerId, player.Name, ParticipantKind.Human))
            .ToList();

        while (players.Count < targetPlayerCount)
        {
            players.Add(new PlayerSlot(
                $"ai-{_nextAiNumber}",
                $"AI {_nextAiNumber}",
                ParticipantKind.Ai));
            _nextAiNumber++;
        }

        var initialChooser = GameEngine.ChooseRoundStarterIndex(players, previousRoundScores: null, _random);

        _match = new MatchState
        {
            Id = Guid.NewGuid().ToString("N"),
            Players = players,
            TargetPlayerCount = targetPlayerCount,
            RoundLimit = roundLimit,
            Status = MatchStatus.Active,
            CurrentRound = GameEngine.CreateRound(players, 1, initialChooser, _random)
        };
    }

    private static bool AllHumanPlayersWantAnotherRoundLocked(MatchState match)
    {
        var humanPlayerIds = match.Players
            .Where(player => player.Kind == ParticipantKind.Human)
            .Select(player => player.Id)
            .ToList();

        return humanPlayerIds.Count > 0 &&
               humanPlayerIds.All(playerId => match.RematchPreferences.TryGetValue(playerId, out var wantsAnotherRound) && wantsAnotherRound);
    }

    private void StartAnotherRoundLocked(MatchState match)
    {
        var previousRound = match.Results.LastOrDefault()
            ?? throw new InvalidOperationException("Es gibt keine abgeschlossene Runde fuer einen Neustart.");

        var nextChooser = GameEngine.ChooseRoundStarterIndex(match.Players, previousRound.Scores, _random);
        match.Status = MatchStatus.Active;
        match.CompletedBecauseRoundLimit = false;
        match.CurrentRound = GameEngine.CreateRound(match.Players, previousRound.RoundNumber + 1, nextChooser, _random);
        match.RematchPreferences.Clear();
    }

    private HumanPlayerSession GetHumanPlayerSession(string token)
    {
        var session = _humanPlayers.SingleOrDefault(player => player.Token == token);
        return session ?? throw new InvalidOperationException("Die Spielersitzung ist ungueltig oder abgelaufen.");
    }

    private void EnsureAdminToken(string token)
    {
        if (!_adminTokens.Contains(token))
        {
            throw new InvalidOperationException("Die Admin-Sitzung ist ungueltig oder abgelaufen.");
        }
    }

    private PlayerSlot GetActivePlayerSlot(string playerId)
    {
        if (_match?.Status != MatchStatus.Active)
        {
            throw new InvalidOperationException("Es laeuft aktuell keine aktive Partie.");
        }

        return _match.Players.SingleOrDefault(player => player.Id == playerId)
            ?? throw new InvalidOperationException("Dieser Spieler nimmt nicht an der aktiven Partie teil.");
    }

    private RoundState GetActiveRound()
    {
        if (_match?.Status != MatchStatus.Active || _match.CurrentRound is null)
        {
            throw new InvalidOperationException("Es gibt aktuell keine aktive Runde.");
        }

        return _match.CurrentRound;
    }

    private GameSnapshot BuildPlayerSnapshotLocked(HumanPlayerSession session)
    {
        var activeMatch = _match;
        var round = activeMatch?.CurrentRound;
        var isViewerInActiveMatch = activeMatch?.Players.Any(player => player.Id == session.PlayerId) == true;
        var viewerPlayer = activeMatch?.Players.SingleOrDefault(player => player.Id == session.PlayerId);
        var viewerHand = isViewerInActiveMatch && round is not null
            ? round.Hands[session.PlayerId].Select(ToCardView).ToList()
            : [];
        var canPlay = round?.Phase == RoundPhase.InProgress &&
                      viewerPlayer is not null &&
                      round.CurrentPlayerIndex.HasValue &&
                      activeMatch!.Players[round.CurrentPlayerIndex.Value].Id == viewerPlayer.Id;
        var playableCards = canPlay ? GameEngine.GetValidSingleCardMoves(round!, session.PlayerId).Select(ToCardView).ToList() : [];
        var canFinishEntireHand = canPlay && GameEngine.CanFinishWithEntireHand(round!, session.PlayerId, out _);
        var canPass = canPlay && GameEngine.CanPass(round!, session.PlayerId);

        return new GameSnapshot(
            "player",
            activeMatch?.Status.ToString() ?? MatchStatus.Lobby.ToString(),
            _humanPlayers.Count,
            activeMatch?.TargetPlayerCount,
            activeMatch?.RoundLimit,
            false,
            false,
            canPlay,
            canPass,
            canFinishEntireHand,
            BuildPlayerMessage(activeMatch, viewerPlayer),
            BuildFinalRankingMessage(activeMatch),
            activeMatch is not null && viewerPlayer is not null && CanVoteForAnotherRound(activeMatch),
            GetViewerWantsAnotherRound(activeMatch, session.PlayerId),
            CountPlayersWantAnotherRound(activeMatch),
            CountPlayersRequiredForAnotherRound(activeMatch),
            session.PlayerId,
            GetActivePlayerId(activeMatch),
            BuildPlayerViews(activeMatch, session.PlayerId),
            viewerHand,
            playableCards,
            BuildRoundView(round),
            BuildResults(activeMatch));
    }

    private GameSnapshot BuildAdminSnapshotLocked(string adminToken)
    {
        EnsureAdminToken(adminToken);

        return new GameSnapshot(
            "admin",
            _match?.Status.ToString() ?? MatchStatus.Lobby.ToString(),
            _humanPlayers.Count,
            _match?.TargetPlayerCount,
            _match?.RoundLimit,
            _match?.Status != MatchStatus.Active,
            _match?.Status == MatchStatus.Active,
            false,
            false,
            false,
            BuildAdminMessage(),
            BuildFinalRankingMessage(_match),
            false,
            null,
            CountPlayersWantAnotherRound(_match),
            CountPlayersRequiredForAnotherRound(_match),
            null,
            GetActivePlayerId(_match),
            BuildPlayerViews(_match, null),
            [],
            [],
            BuildRoundView(_match?.CurrentRound),
            BuildResults(_match));
    }

    private IReadOnlyList<PlayerView> BuildPlayerViews(MatchState? match, string? viewerPlayerId)
    {
        if (match is null)
        {
            return _humanPlayers
                .Select(player => new PlayerView(player.PlayerId, player.Name, ParticipantKind.Human.ToString(), 0, false, false, player.PlayerId == viewerPlayerId))
                .ToList();
        }

        return match.Players
            .Select((player, index) =>
            {
                var round = match.CurrentRound;
                var cardCount = round is not null && round.Hands.TryGetValue(player.Id, out var hand) ? hand.Count : 0;
                return new PlayerView(
                    player.Id,
                    player.Name,
                    player.Kind.ToString(),
                    cardCount,
                    round?.CurrentPlayerIndex == index,
                    round?.StartRank.HasValue == true && round.ChooserIndex == index,
                    player.Id == viewerPlayerId);
            })
            .ToList();
    }

    private static RoundView? BuildRoundView(RoundState? round)
    {
        if (round is null)
        {
            return null;
        }

        var rows = Enum.GetValues<CardSuit>()
            .Select(suit =>
            {
                if (!round.Rows.TryGetValue(suit, out var row))
                {
                    return new RowView(suit.ToString(), false, null, null, null);
                }

                return new RowView(
                    suit.ToString(),
                    true,
                    ToCardView(new Card(suit, row.LowestRank)),
                    ToCardView(new Card(suit, row.HighestRank)),
                    ToCardView(new Card(suit, row.StartRank)));
            })
            .ToList();

        return new RoundView(
            round.Number,
            round.Phase.ToString(),
            round.StartRank?.ToString(),
            rows,
            round.Actions
                .Select(action => new ActionView(
                    action.TurnNumber,
                    action.Type,
                    action.PlayerId,
                    action.PlayerName,
                    action.Summary,
                    action.Cards.Select(ToCardView).ToList()))
                .ToList());
    }

    private static IReadOnlyList<RoundResultView> BuildResults(MatchState? match) =>
        match?.Results
            .OrderByDescending(result => result.RoundNumber)
            .Select(result => new RoundResultView(
                result.RoundNumber,
                result.WinnerPlayerId,
                result.WinnerName,
                result.StartRank.ToString(),
                result.Scores
                    .Select(score => new PlayerRoundScoreView(
                        score.PlayerId,
                        score.PlayerName,
                        score.RemainingCardCount))
                    .ToList()))
            .ToList() ?? [];

    private static IReadOnlyList<PlayerRoundScore> BuildRoundScores(RoundState round, IReadOnlyList<PlayerSlot> players) =>
        players
            .Select(player => new PlayerRoundScore(
                player.Id,
                player.Name,
                round.Hands.TryGetValue(player.Id, out var hand) ? hand.Count : 0))
            .ToList();

    private static string? GetActivePlayerId(MatchState? match)
    {
        if (match?.CurrentRound?.CurrentPlayerIndex is not int currentPlayerIndex)
        {
            return null;
        }

        return match.Players[currentPlayerIndex].Id;
    }

    private string BuildPlayerMessage(MatchState? match, PlayerSlot? viewerPlayer)
    {
        if (match is null)
        {
            return "Warte auf den Administrator, damit eine Partie gestartet wird.";
        }

        if (match.Status == MatchStatus.Completed)
        {
            if (match.CompletedBecauseRoundLimit && match.RoundLimit.HasValue)
            {
                var viewerDecision = GetViewerWantsAnotherRound(match, viewerPlayer?.Id);
                var votesNeeded = CountPlayersRequiredForAnotherRound(match) - CountPlayersWantAnotherRound(match);

                return viewerDecision switch
                {
                    true when votesNeeded > 0 => $"Du bist bereit fuer eine weitere Runde. Es fehlen noch {votesNeeded} Zusage{(votesNeeded == 1 ? string.Empty : "n")}.",
                    true => "Alle realen Spieler sind bereit. Die naechste Runde startet automatisch.",
                    false => "Du hast vorerst gegen eine weitere Runde gestimmt.",
                    _ => "Die Partie ist beendet. Entscheide, ob du noch eine weitere Runde spielen moechtest."
                };
            }

            return "Die Partie wurde vom Administrator beendet.";
        }

        if (viewerPlayer is null)
        {
            return "Diese Partie laeuft ohne dich. Bitte warte auf die naechste Runde.";
        }

        var round = match.CurrentRound;
        if (round is null)
        {
            return "Warte auf die erste Runde.";
        }

        if (round.Phase == RoundPhase.InProgress && round.CurrentPlayerIndex.HasValue && match.Players[round.CurrentPlayerIndex.Value].Id == viewerPlayer.Id)
        {
            return round.StartRank.HasValue
                ? "Du bist am Zug."
                : "Du beginnst die Runde. Spiele die Startkarte.";
        }

        return round.StartRank.HasValue ? "Warte auf deinen Zug." : "Warte auf die Startkarte.";
    }

    private string BuildAdminMessage()
    {
        if (_match is null)
        {
            return "Lobby offen. Der Administrator kann eine Partie starten, sobald genug Spieler beigetreten sind.";
        }

        return _match.Status switch
        {
            MatchStatus.Active => _match.RoundLimit.HasValue
                ? $"Partie laeuft mit festem Limit von {_match.RoundLimit.Value} Runde{(_match.RoundLimit.Value == 1 ? string.Empty : "n")}."
                : "Partie laeuft ohne Rundelimit. Der Administrator kann sie jederzeit beenden.",
            MatchStatus.Completed when _match.CompletedBecauseRoundLimit && _match.RoundLimit.HasValue =>
                $"{CountPlayersWantAnotherRound(_match)}/{CountPlayersRequiredForAnotherRound(_match)} reale Spieler moechten eine weitere Runde.",
            MatchStatus.Completed => "Die letzte Partie wurde beendet. Eine neue Partie kann gestartet werden.",
            _ => "Lobby offen."
        };
    }

    private static string? BuildFinalRankingMessage(MatchState? match)
    {
        if (match?.Status != MatchStatus.Completed || !match.CompletedBecauseRoundLimit || !match.RoundLimit.HasValue || match.Results.Count == 0)
        {
            return null;
        }

        return $"Die Partie ist nach {match.RoundLimit.Value} Runde{(match.RoundLimit.Value == 1 ? string.Empty : "n")} beendet. Wenn alle realen Spieler zustimmen, startet automatisch die naechste Runde.";
    }

    private static bool CanVoteForAnotherRound(MatchState match) =>
        match.Status == MatchStatus.Completed &&
        match.CompletedBecauseRoundLimit &&
        match.Results.Count > 0;

    private static bool? GetViewerWantsAnotherRound(MatchState? match, string? playerId)
    {
        if (match is null || string.IsNullOrWhiteSpace(playerId) || !match.RematchPreferences.TryGetValue(playerId, out var wantsAnotherRound))
        {
            return null;
        }

        return wantsAnotherRound;
    }

    private static int CountPlayersWantAnotherRound(MatchState? match) =>
        match?.RematchPreferences.Count(entry => entry.Value) ?? 0;

    private static int CountPlayersRequiredForAnotherRound(MatchState? match) =>
        match?.Players.Count(player => player.Kind == ParticipantKind.Human) ?? 0;

    private static CardView ToCardView(Card card) =>
        new(
            card.Code,
            card.Suit.ToString(),
            card.Rank.ToString(),
            card.DisplayName);

    private Task NotifyStateChangedAsync() =>
        hubContext.Clients.Group("game").SendAsync("StateChanged");

    private Task NotifyResetAsync() =>
        hubContext.Clients.Group("game").SendAsync("Reset");

    private sealed record HumanPlayerSession(string PlayerId, string Name, string Token);
}

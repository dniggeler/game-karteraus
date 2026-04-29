namespace Kartenreihen.Api.Contracts;

public sealed record PlayerJoinRequest(string Name);

public sealed record AdminLoginRequest(string Code);

public sealed record StartGameRequest(string AdminToken, int TargetPlayerCount);

public sealed record EndGameRequest(string AdminToken);

public sealed record ResetGameRequest(string AdminToken);

public sealed record PassTurnRequest(string PlayerToken);

public sealed record PlayCardsRequest(string PlayerToken, IReadOnlyList<CardRequest> Cards);

public sealed record CardRequest(string Suit, string Rank);

public sealed record SessionResponse(string Token, GameSnapshot Snapshot);

public sealed record ResetGameResponse(bool Reset);

public sealed record GameSnapshot(
    string ViewerRole,
    string MatchStatus,
    int HumanPlayers,
    int? TargetPlayerCount,
    bool CanStartGame,
    bool CanEndGame,
    bool CanPlay,
    bool CanPass,
    bool CanFinishEntireHand,
    string? Message,
    string? ViewerPlayerId,
    string? ActivePlayerId,
    IReadOnlyList<PlayerView> Players,
    IReadOnlyList<CardView> ViewerHand,
    IReadOnlyList<CardView> PlayableCards,
    RoundView? CurrentRound,
    IReadOnlyList<RoundResultView> Results);

public sealed record PlayerView(
    string Id,
    string Name,
    string Kind,
    int CardCount,
    bool IsCurrentTurn,
    bool IsRoundStarter,
    bool IsViewer);

public sealed record CardView(string Code, string Suit, string Rank, string Label);

public sealed record RowView(
    string Suit,
    bool IsOpen,
    CardView? LowestCard,
    CardView? HighestCard,
    CardView? StartCard);

public sealed record ActionView(
    int TurnNumber,
    string Type,
    string PlayerId,
    string PlayerName,
    string Summary,
    IReadOnlyList<CardView> Cards);

public sealed record RoundView(
    int Number,
    string Phase,
    string? StartRank,
    IReadOnlyList<RowView> Rows,
    IReadOnlyList<ActionView> Actions);

public sealed record RoundResultView(
    int RoundNumber,
    string WinnerPlayerId,
    string WinnerName,
    string StartRank,
    IReadOnlyList<PlayerRoundScoreView> Scores);

public sealed record PlayerRoundScoreView(
    string PlayerId,
    string PlayerName,
    int RemainingCardCount);

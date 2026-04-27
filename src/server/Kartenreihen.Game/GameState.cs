namespace Kartenreihen.Game;

public enum ParticipantKind
{
    Human,
    Ai
}

public enum MatchStatus
{
    Lobby,
    Active,
    Completed
}

public enum RoundPhase
{
    AwaitingStartValue,
    InProgress,
    Completed
}

public sealed record PlayerSlot(string Id, string Name, ParticipantKind Kind);

public sealed record RoundAction(
    int TurnNumber,
    string Type,
    string PlayerId,
    string PlayerName,
    string Summary,
    IReadOnlyList<Card> Cards);

public sealed record RoundResult(
    int RoundNumber,
    string WinnerPlayerId,
    string WinnerName,
    CardRank StartRank,
    int ChooserIndex,
    IReadOnlyList<PlayerRoundScore> Scores);

public sealed record PlayerRoundScore(
    string PlayerId,
    string PlayerName,
    int RemainingCardCount);

public sealed class SuitRow
{
    public SuitRow(CardSuit suit, CardRank startRank)
    {
        Suit = suit;
        StartRank = startRank;
        LowestRank = startRank;
        HighestRank = startRank;
    }

    public CardSuit Suit { get; }

    public CardRank StartRank { get; }

    public CardRank LowestRank { get; set; }

    public CardRank HighestRank { get; set; }

    public SuitRow Clone() =>
        new(Suit, StartRank)
        {
            LowestRank = LowestRank,
            HighestRank = HighestRank
        };
}

public sealed class RoundState
{
    public required int Number { get; init; }

    public required int ChooserIndex { get; init; }

    public required Dictionary<string, List<Card>> Hands { get; init; }

    public required Dictionary<CardSuit, SuitRow> Rows { get; init; }

    public required List<RoundAction> Actions { get; init; }

    public RoundPhase Phase { get; set; } = RoundPhase.AwaitingStartValue;

    public CardRank? StartRank { get; set; }

    public int? CurrentPlayerIndex { get; set; }

    public string? WinnerPlayerId { get; set; }
}

public sealed class MatchState
{
    public required string Id { get; init; }

    public required List<PlayerSlot> Players { get; init; }

    public required int TargetPlayerCount { get; init; }

    public MatchStatus Status { get; set; } = MatchStatus.Lobby;

    public RoundState? CurrentRound { get; set; }

    public List<RoundResult> Results { get; } = [];
}

namespace Kartenreihen.Game;

public enum CardRank
{
    Six = 0,
    Seven = 1,
    Eight = 2,
    Nine = 3,
    Ten = 4,
    Jack = 5,
    Queen = 6,
    King = 7,
    Ace = 8
}

public static class CardRankExtensions
{
    public static IReadOnlyList<CardRank> OrderedRanks { get; } =
    [
        CardRank.Six,
        CardRank.Seven,
        CardRank.Eight,
        CardRank.Nine,
        CardRank.Ten,
        CardRank.Jack,
        CardRank.Queen,
        CardRank.King,
        CardRank.Ace
    ];

    public static string GetDisplayName(this CardRank rank) =>
        rank switch
        {
            CardRank.Six => "6",
            CardRank.Seven => "7",
            CardRank.Eight => "8",
            CardRank.Nine => "9",
            CardRank.Ten => "10",
            CardRank.Jack => "Bube",
            CardRank.Queen => "Dame",
            CardRank.King => "Koenig",
            CardRank.Ace => "As",
            _ => throw new ArgumentOutOfRangeException(nameof(rank), rank, null)
        };

    public static string GetCode(this CardRank rank) =>
        rank switch
        {
            CardRank.Six => "6",
            CardRank.Seven => "7",
            CardRank.Eight => "8",
            CardRank.Nine => "9",
            CardRank.Ten => "10",
            CardRank.Jack => "J",
            CardRank.Queen => "Q",
            CardRank.King => "K",
            CardRank.Ace => "A",
            _ => throw new ArgumentOutOfRangeException(nameof(rank), rank, null)
        };

    public static CardRank? NextHigher(this CardRank rank)
    {
        var index = (int)rank;
        return index >= OrderedRanks.Count - 1 ? null : OrderedRanks[index + 1];
    }

    public static CardRank? NextLower(this CardRank rank)
    {
        var index = (int)rank;
        return index <= 0 ? null : OrderedRanks[index - 1];
    }

    public static bool TryParse(string value, out CardRank rank)
    {
        foreach (var candidate in OrderedRanks)
        {
            if (string.Equals(candidate.ToString(), value, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(candidate.GetDisplayName(), value, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(candidate.GetCode(), value, StringComparison.OrdinalIgnoreCase))
            {
                rank = candidate;
                return true;
            }
        }

        rank = default;
        return false;
    }
}

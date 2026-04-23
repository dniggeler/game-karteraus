namespace Kartenreihen.Game;

public enum CardSuit
{
    Hearts,
    Diamonds,
    Clubs,
    Spades
}

public static class CardSuitExtensions
{
    public static string GetDisplayName(this CardSuit suit) =>
        suit switch
        {
            CardSuit.Hearts => "Herz",
            CardSuit.Diamonds => "Karo",
            CardSuit.Clubs => "Kreuz",
            CardSuit.Spades => "Pik",
            _ => throw new ArgumentOutOfRangeException(nameof(suit), suit, null)
        };

    public static string GetShortName(this CardSuit suit) =>
        suit switch
        {
            CardSuit.Hearts => "H",
            CardSuit.Diamonds => "D",
            CardSuit.Clubs => "C",
            CardSuit.Spades => "S",
            _ => throw new ArgumentOutOfRangeException(nameof(suit), suit, null)
        };

    public static int GetOrder(this CardSuit suit) =>
        suit switch
        {
            CardSuit.Hearts => 0,
            CardSuit.Diamonds => 1,
            CardSuit.Clubs => 2,
            CardSuit.Spades => 3,
            _ => throw new ArgumentOutOfRangeException(nameof(suit), suit, null)
        };
}

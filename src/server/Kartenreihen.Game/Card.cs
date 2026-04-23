namespace Kartenreihen.Game;

public readonly record struct Card(CardSuit Suit, CardRank Rank)
{
    public string Code => $"{Suit.GetShortName()}{Rank.GetCode()}";

    public string DisplayName => $"{Rank.GetDisplayName()} {Suit.GetDisplayName()}";
}

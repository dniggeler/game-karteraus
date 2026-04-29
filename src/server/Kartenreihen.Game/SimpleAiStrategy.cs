namespace Kartenreihen.Game;

public sealed class SimpleAiStrategy
{
    public AiDecision ChooseTurn(RoundState round, PlayerSlot player)
    {
        ArgumentNullException.ThrowIfNull(round);
        ArgumentNullException.ThrowIfNull(player);

        if (GameEngine.CanFinishWithEntireHand(round, player.Id, out var finishingSequence) && finishingSequence.Count > 0)
        {
            return AiDecision.Play(finishingSequence);
        }

        var singleCardMoves = GameEngine.GetValidSingleCardMoves(round, player.Id);
        if (singleCardMoves.Count == 0)
        {
            return AiDecision.Pass();
        }

        var selectedCard = singleCardMoves
            .OrderBy(card => card.Suit.GetOrder())
            .ThenBy(card => (int)card.Rank)
            .First();

        return AiDecision.Play([selectedCard]);
    }
}

public sealed record AiDecision(bool ShouldPass, IReadOnlyList<Card> Cards)
{
    public static AiDecision Pass() => new(true, []);

    public static AiDecision Play(IReadOnlyList<Card> cards) => new(false, cards);
}

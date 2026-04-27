using Kartenreihen.Game;

namespace Kartenreihen.Game.Tests;

public class GameEngineTests
{
    [Fact]
    public void CardSuitOrder_MatchesHerzPikKaroKreuz()
    {
        var suits = Enum.GetValues<CardSuit>()
            .OrderBy(suit => suit.GetOrder())
            .ToArray();

        Assert.Equal(
            [CardSuit.Hearts, CardSuit.Spades, CardSuit.Diamonds, CardSuit.Clubs],
            suits);
    }

    [Fact]
    public void SingleCardMove_OpensNewRow_WhenCardMatchesStartRank()
    {
        var players = CreatePlayers();
        var round = CreateRound(players, chooserIndex: 0, startRank: CardRank.Eight, currentPlayerIndex: 2);
        round.Hands["p3"] = [new Card(CardSuit.Hearts, CardRank.Eight)];

        GameEngine.ApplyPlay(round, players, players[2], [new Card(CardSuit.Hearts, CardRank.Eight)]);

        var row = round.Rows[CardSuit.Hearts];
        Assert.Equal(CardRank.Eight, row.LowestRank);
        Assert.Equal(CardRank.Eight, row.HighestRank);
        Assert.Equal(RoundPhase.Completed, round.Phase);
        Assert.Equal("p3", round.WinnerPlayerId);
    }

    [Fact]
    public void MultiCardFinish_IsAllowed_WhenEntireHandCanBePlayed()
    {
        var players = CreatePlayers();
        var round = CreateRound(players, chooserIndex: 0, startRank: CardRank.Ten, currentPlayerIndex: 2);
        round.Hands["p3"] =
        [
            new Card(CardSuit.Diamonds, CardRank.Ten),
            new Card(CardSuit.Clubs, CardRank.Ten)
        ];

        GameEngine.ApplyPlay(
            round,
            players,
            players[2],
            [
                new Card(CardSuit.Clubs, CardRank.Ten),
                new Card(CardSuit.Diamonds, CardRank.Ten)
            ]);

        Assert.Equal(RoundPhase.Completed, round.Phase);
        Assert.Equal("p3", round.WinnerPlayerId);
        Assert.Equal(2, round.Actions.Last().Cards.Count);
    }

    [Fact]
    public void MultiCardFinish_IsRejected_WhenEntireHandCannotBePlayed()
    {
        var players = CreatePlayers();
        var round = CreateRound(players, chooserIndex: 0, startRank: CardRank.Ten, currentPlayerIndex: 2);
        round.Hands["p3"] =
        [
            new Card(CardSuit.Diamonds, CardRank.Ten),
            new Card(CardSuit.Clubs, CardRank.Nine)
        ];

        var exception = Assert.Throws<InvalidOperationException>(() =>
            GameEngine.ApplyPlay(
                round,
                players,
                players[2],
                [
                    new Card(CardSuit.Diamonds, CardRank.Ten),
                    new Card(CardSuit.Clubs, CardRank.Nine)
                ]));

        Assert.Contains("gesamte Hand", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void CanFinishWithEntireHand_ResolvesSequentialOrderAcrossRows()
    {
        var players = CreatePlayers();
        var round = CreateRound(players, chooserIndex: 0, startRank: CardRank.Eight, currentPlayerIndex: 2);
        round.Rows[CardSuit.Hearts] = new SuitRow(CardSuit.Hearts, CardRank.Eight)
        {
            LowestRank = CardRank.Eight,
            HighestRank = CardRank.Nine
        };
        round.Hands["p3"] =
        [
            new Card(CardSuit.Hearts, CardRank.Ten),
            new Card(CardSuit.Spades, CardRank.Eight)
        ];

        var canFinish = GameEngine.CanFinishWithEntireHand(round, "p3", out var sequence);

        Assert.True(canFinish);
        Assert.Equal(2, sequence.Count);
        Assert.Contains(new Card(CardSuit.Spades, CardRank.Eight), sequence);
        Assert.Contains(new Card(CardSuit.Hearts, CardRank.Ten), sequence);
    }

    [Fact]
    public void CanPass_IsFalse_WhenSingleCardMoveExists()
    {
        var players = CreatePlayers();
        var round = CreateRound(players, chooserIndex: 0, startRank: CardRank.Eight, currentPlayerIndex: 2);
        round.Hands["p3"] = [new Card(CardSuit.Hearts, CardRank.Eight)];

        var canPass = GameEngine.CanPass(round, "p3");

        Assert.False(canPass);
    }

    [Fact]
    public void ApplyPass_IsRejected_WhenValidMoveExists()
    {
        var players = CreatePlayers();
        var round = CreateRound(players, chooserIndex: 0, startRank: CardRank.Eight, currentPlayerIndex: 2);
        round.Hands["p3"] = [new Card(CardSuit.Hearts, CardRank.Eight)];

        var exception = Assert.Throws<InvalidOperationException>(() =>
            GameEngine.ApplyPass(round, players, players[2]));

        Assert.Contains("Passen ist nicht erlaubt", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void CanPass_IsTrue_WhenNoValidMoveExists()
    {
        var players = CreatePlayers();
        var round = CreateRound(players, chooserIndex: 0, startRank: CardRank.Eight, currentPlayerIndex: 2);
        round.Hands["p3"] = [new Card(CardSuit.Hearts, CardRank.Six)];

        var canPass = GameEngine.CanPass(round, "p3");

        Assert.True(canPass);
    }

    [Fact]
    public void SelectStartRank_SetsFirstTurnToPlayerRightOfChooser()
    {
        var players = CreatePlayers();
        var round = GameEngine.CreateRound(players, roundNumber: 1, chooserIndex: 1, random: new Random(123));

        GameEngine.SelectStartRank(round, players, players[1], CardRank.Queen);

        Assert.Equal(CardRank.Queen, round.StartRank);
        Assert.Equal(RoundPhase.InProgress, round.Phase);
        Assert.Equal(0, round.CurrentPlayerIndex);
    }

    private static List<PlayerSlot> CreatePlayers() =>
    [
        new("p1", "Anna", ParticipantKind.Human),
        new("p2", "Bert", ParticipantKind.Human),
        new("p3", "Clara", ParticipantKind.Human)
    ];

    private static RoundState CreateRound(
        IReadOnlyList<PlayerSlot> players,
        int chooserIndex,
        CardRank startRank,
        int currentPlayerIndex)
    {
        var round = new RoundState
        {
            Number = 1,
            ChooserIndex = chooserIndex,
            Phase = RoundPhase.InProgress,
            StartRank = startRank,
            CurrentPlayerIndex = currentPlayerIndex,
            Hands = players.ToDictionary(player => player.Id, _ => new List<Card>()),
            Rows = [],
            Actions = []
        };

        return round;
    }
}

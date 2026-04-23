namespace Kartenreihen.Game;

public static class GameEngine
{
    private static readonly CardSuit[] OrderedSuits =
    [
        CardSuit.Hearts,
        CardSuit.Diamonds,
        CardSuit.Clubs,
        CardSuit.Spades
    ];

    public static RoundState CreateRound(
        IReadOnlyList<PlayerSlot> players,
        int roundNumber,
        int chooserIndex,
        Random random)
    {
        ArgumentNullException.ThrowIfNull(players);
        ArgumentNullException.ThrowIfNull(random);

        if (players.Count is not 3 and not 4)
        {
            throw new InvalidOperationException("Eine Runde benoetigt genau 3 oder 4 Spieler.");
        }

        var deck = CreateShuffledDeck(random).ToList();
        var cardsPerPlayer = deck.Count / players.Count;
        var hands = new Dictionary<string, List<Card>>(players.Count);

        for (var index = 0; index < players.Count; index++)
        {
            var hand = deck
                .Skip(index * cardsPerPlayer)
                .Take(cardsPerPlayer)
                .OrderBy(card => card.Suit.GetOrder())
                .ThenBy(card => (int)card.Rank)
                .ToList();

            hands[players[index].Id] = hand;
        }

        return new RoundState
        {
            Number = roundNumber,
            ChooserIndex = chooserIndex,
            Hands = hands,
            Rows = [],
            Actions = []
        };
    }

    public static int PreviousIndex(int index, int totalCount) =>
        (index - 1 + totalCount) % totalCount;

    public static IReadOnlyList<Card> GetValidSingleCardMoves(RoundState round, string playerId)
    {
        ArgumentNullException.ThrowIfNull(round);
        ArgumentException.ThrowIfNullOrEmpty(playerId);

        if (round.Phase != RoundPhase.InProgress || !round.StartRank.HasValue)
        {
            return [];
        }

        return round.Hands[playerId]
            .Where(card => IsValidSingleCardMove(round.Rows, round.StartRank.Value, card))
            .ToList();
    }

    public static bool CanFinishWithEntireHand(
        RoundState round,
        string playerId,
        out IReadOnlyList<Card> orderedCards)
    {
        ArgumentNullException.ThrowIfNull(round);
        ArgumentException.ThrowIfNullOrEmpty(playerId);

        orderedCards = [];

        if (round.Phase != RoundPhase.InProgress || !round.StartRank.HasValue)
        {
            return false;
        }

        var remainingCards = round.Hands[playerId].ToList();
        var rows = CloneRows(round.Rows);
        var path = new List<Card>(remainingCards.Count);
        var visited = new HashSet<string>(StringComparer.Ordinal);

        if (!TryResolvePlayableSequence(remainingCards, rows, round.StartRank.Value, path, visited))
        {
            return false;
        }

        orderedCards = path;
        return true;
    }

    public static void SelectStartRank(RoundState round, IReadOnlyList<PlayerSlot> players, PlayerSlot chooser, CardRank rank)
    {
        ArgumentNullException.ThrowIfNull(round);
        ArgumentNullException.ThrowIfNull(players);
        ArgumentNullException.ThrowIfNull(chooser);

        if (round.Phase != RoundPhase.AwaitingStartValue)
        {
            throw new InvalidOperationException("Der Startwert wurde bereits festgelegt.");
        }

        if (players[round.ChooserIndex].Id != chooser.Id)
        {
            throw new InvalidOperationException("Nur der berechtigte Spieler darf den Startwert waehlen.");
        }

        round.StartRank = rank;
        round.Phase = RoundPhase.InProgress;
        round.CurrentPlayerIndex = PreviousIndex(round.ChooserIndex, players.Count);
        round.Actions.Add(new RoundAction(
            round.Actions.Count + 1,
            "select-start-rank",
            chooser.Id,
            chooser.Name,
            $"{chooser.Name} waehlt {rank.GetDisplayName()} als Startwert.",
            []));
    }

    public static void ApplyPass(RoundState round, IReadOnlyList<PlayerSlot> players, PlayerSlot player)
    {
        ArgumentNullException.ThrowIfNull(round);
        ArgumentNullException.ThrowIfNull(players);
        ArgumentNullException.ThrowIfNull(player);

        EnsurePlayerTurn(round, players, player);

        round.Actions.Add(new RoundAction(
            round.Actions.Count + 1,
            "pass",
            player.Id,
            player.Name,
            $"{player.Name} passt.",
            []));

        round.CurrentPlayerIndex = PreviousIndex(round.CurrentPlayerIndex!.Value, players.Count);
    }

    public static void ApplyPlay(RoundState round, IReadOnlyList<PlayerSlot> players, PlayerSlot player, IReadOnlyList<Card> selectedCards)
    {
        ArgumentNullException.ThrowIfNull(round);
        ArgumentNullException.ThrowIfNull(players);
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(selectedCards);

        EnsurePlayerTurn(round, players, player);

        if (selectedCards.Count == 0)
        {
            throw new InvalidOperationException("Es muss mindestens eine Karte gespielt werden.");
        }

        var hand = round.Hands[player.Id];
        if (!selectedCards.All(hand.Contains))
        {
            throw new InvalidOperationException("Die ausgewaehlten Karten befinden sich nicht auf der Hand.");
        }

        IReadOnlyList<Card> cardsToPlay;
        if (selectedCards.Count == 1)
        {
            var candidate = selectedCards[0];
            if (!IsValidSingleCardMove(round.Rows, round.StartRank!.Value, candidate))
            {
                throw new InvalidOperationException("Diese Karte ist aktuell nicht gueltig spielbar.");
            }

            cardsToPlay = [candidate];
        }
        else
        {
            if (selectedCards.Count != hand.Count || selectedCards.Except(hand).Any() || hand.Except(selectedCards).Any())
            {
                throw new InvalidOperationException("Mehrere Karten duerfen nur ausgespielt werden, wenn damit die gesamte Hand abgelegt wird.");
            }

            if (!CanFinishWithEntireHand(round, player.Id, out cardsToPlay))
            {
                throw new InvalidOperationException("Die gesamte Hand kann in diesem Zug nicht regelkonform abgelegt werden.");
            }
        }

        foreach (var card in cardsToPlay)
        {
            ApplyCard(round.Rows, round.StartRank!.Value, card);
            hand.Remove(card);
        }

        round.Actions.Add(new RoundAction(
            round.Actions.Count + 1,
            "play",
            player.Id,
            player.Name,
            cardsToPlay.Count == 1
                ? $"{player.Name} spielt {cardsToPlay[0].DisplayName}."
                : $"{player.Name} spielt {cardsToPlay.Count} Karten und beendet damit die Runde.",
            cardsToPlay.ToList()));

        if (hand.Count == 0)
        {
            round.Phase = RoundPhase.Completed;
            round.WinnerPlayerId = player.Id;
            round.CurrentPlayerIndex = null;
            return;
        }

        round.CurrentPlayerIndex = PreviousIndex(round.CurrentPlayerIndex!.Value, players.Count);
    }

    private static IReadOnlyList<Card> CreateShuffledDeck(Random random) =>
        OrderedSuits
            .SelectMany(suit => CardRankExtensions.OrderedRanks.Select(rank => new Card(suit, rank)))
            .OrderBy(_ => random.Next())
            .ToList();

    private static bool IsValidSingleCardMove(Dictionary<CardSuit, SuitRow> rows, CardRank startRank, Card card)
    {
        if (!rows.TryGetValue(card.Suit, out var row))
        {
            return card.Rank == startRank;
        }

        return row.LowestRank.NextLower() == card.Rank || row.HighestRank.NextHigher() == card.Rank;
    }

    private static void ApplyCard(Dictionary<CardSuit, SuitRow> rows, CardRank startRank, Card card)
    {
        if (!rows.TryGetValue(card.Suit, out var row))
        {
            rows[card.Suit] = new SuitRow(card.Suit, startRank);
            return;
        }

        if (row.LowestRank.NextLower() == card.Rank)
        {
            row.LowestRank = card.Rank;
            return;
        }

        if (row.HighestRank.NextHigher() == card.Rank)
        {
            row.HighestRank = card.Rank;
            return;
        }

        throw new InvalidOperationException("Die Karte kann an diese Reihe nicht angelegt werden.");
    }

    private static void EnsurePlayerTurn(RoundState round, IReadOnlyList<PlayerSlot> players, PlayerSlot player)
    {
        if (round.Phase != RoundPhase.InProgress)
        {
            throw new InvalidOperationException("Die Runde befindet sich nicht in einem spielbaren Zustand.");
        }

        if (!round.StartRank.HasValue || !round.CurrentPlayerIndex.HasValue)
        {
            throw new InvalidOperationException("Die Runde ist noch nicht gestartet.");
        }

        if (players[round.CurrentPlayerIndex.Value].Id != player.Id)
        {
            throw new InvalidOperationException("Dieser Spieler ist gerade nicht am Zug.");
        }
    }

    private static Dictionary<CardSuit, SuitRow> CloneRows(Dictionary<CardSuit, SuitRow> rows) =>
        rows.ToDictionary(entry => entry.Key, entry => entry.Value.Clone());

    private static bool TryResolvePlayableSequence(
        List<Card> remainingCards,
        Dictionary<CardSuit, SuitRow> rows,
        CardRank startRank,
        List<Card> path,
        HashSet<string> visited)
    {
        if (remainingCards.Count == 0)
        {
            return true;
        }

        var stateKey = SerializeState(remainingCards, rows);
        if (!visited.Add(stateKey))
        {
            return false;
        }

        foreach (var card in remainingCards.OrderBy(card => card.Suit.GetOrder()).ThenBy(card => (int)card.Rank).ToList())
        {
            if (!IsValidSingleCardMove(rows, startRank, card))
            {
                continue;
            }

            var nextRows = CloneRows(rows);
            ApplyCard(nextRows, startRank, card);

            var nextRemaining = remainingCards.Where(candidate => candidate != card).ToList();
            path.Add(card);

            if (TryResolvePlayableSequence(nextRemaining, nextRows, startRank, path, visited))
            {
                return true;
            }

            path.RemoveAt(path.Count - 1);
        }

        return false;
    }

    private static string SerializeState(List<Card> remainingCards, Dictionary<CardSuit, SuitRow> rows)
    {
        var cardsKey = string.Join(",", remainingCards.OrderBy(card => card.Code).Select(card => card.Code));
        var rowsKey = string.Join(
            "|",
            OrderedSuits
                .Where(rows.ContainsKey)
                .Select(suit =>
                {
                    var row = rows[suit];
                    return $"{suit.GetShortName()}:{row.LowestRank.GetCode()}-{row.HighestRank.GetCode()}";
                }));

        return $"{cardsKey}::{rowsKey}";
    }
}

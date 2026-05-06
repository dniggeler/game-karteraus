using Kartenreihen.Api;
using Kartenreihen.Api.Hubs;
using Kartenreihen.Api.Services;
using Kartenreihen.Game;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Kartenreihen.Game.Tests;

public class GameSessionServiceTests
{
    [Fact]
    public async Task PlayCardsAsync_PausesBeforeAiActs()
    {
        var service = CreateService(aiMoveDelayMilliseconds: 25);
        var playerSession = await service.JoinPlayerAsync("Anna");
        var adminSession = await service.LoginAdminAsync("admin");

        await service.StartGameAsync(adminSession.Token, 3, roundLimit: null);

        var chooserSnapshot = await WaitForPlayerTurnAsync(service, playerSession.Token);
        var actionCountBeforePlay = chooserSnapshot.CurrentRound!.Actions.Count;
        var playedCard = chooserSnapshot.PlayableCards[0];
        var immediateSnapshot = await service.PlayCardsAsync(playerSession.Token, [ToCard(playedCard)]);

        var activeAi = immediateSnapshot.Players.Single(player => player.IsCurrentTurn);
        Assert.Equal("Ai", activeAi.Kind);
        Assert.Equal(actionCountBeforePlay + 1, immediateSnapshot.CurrentRound!.Actions.Count);

        await Task.Delay(80);

        var delayedSnapshot = service.RestorePlayerSession(playerSession.Token).Snapshot;
        Assert.True(delayedSnapshot.CurrentRound!.Actions.Count >= 3);
    }

    [Fact]
    public async Task StartGameAsync_WithRoundLimit_CompletesMatchAfterFinalRound()
    {
        var service = CreateService(aiMoveDelayMilliseconds: 1);
        var playerSession = await service.JoinPlayerAsync("Anna");
        var adminSession = await service.LoginAdminAsync("admin");

        await service.StartGameAsync(adminSession.Token, 3, roundLimit: 1);

        var completedSnapshot = await PlayUntilMatchCompletedAsync(service, playerSession.Token);

        Assert.Equal(MatchStatus.Completed.ToString(), completedSnapshot.MatchStatus);
        Assert.Null(completedSnapshot.CurrentRound);
        Assert.Equal(1, completedSnapshot.RoundLimit);
        Assert.Single(completedSnapshot.Results);
        Assert.NotNull(completedSnapshot.FinalRankingMessage);
        Assert.Contains("Endrangliste nach 1 Runde", completedSnapshot.FinalRankingMessage);
    }

    private static async Task<Kartenreihen.Api.Contracts.GameSnapshot> WaitForPlayerTurnAsync(GameSessionService service, string playerToken)
    {
        for (var attempt = 0; attempt < 20; attempt++)
        {
            var snapshot = service.RestorePlayerSession(playerToken).Snapshot;
            if (snapshot.CanPlay)
            {
                return snapshot;
            }

            await Task.Delay(40);
        }

        throw new InvalidOperationException("Der menschliche Spieler wurde nicht rechtzeitig am Zug.");
    }

    private static async Task<Kartenreihen.Api.Contracts.GameSnapshot> PlayUntilMatchCompletedAsync(GameSessionService service, string playerToken)
    {
        for (var attempt = 0; attempt < 400; attempt++)
        {
            var snapshot = service.RestorePlayerSession(playerToken).Snapshot;
            if (snapshot.MatchStatus == MatchStatus.Completed.ToString())
            {
                return snapshot;
            }

            if (snapshot.CanFinishEntireHand)
            {
                await service.PlayCardsAsync(playerToken, snapshot.ViewerHand.Select(ToCard).ToList());
                await Task.Delay(5);
                continue;
            }

            if (snapshot.CanPlay && snapshot.PlayableCards.Count > 0)
            {
                await service.PlayCardsAsync(playerToken, [ToCard(snapshot.PlayableCards[0])]);
                await Task.Delay(5);
                continue;
            }

            if (snapshot.CanPass)
            {
                await service.PassAsync(playerToken);
                await Task.Delay(5);
                continue;
            }

            await Task.Delay(5);
        }

        throw new InvalidOperationException("Die Partie wurde nicht rechtzeitig abgeschlossen.");
    }

    private static GameSessionService CreateService(int aiMoveDelayMilliseconds) =>
        new(
            new NoOpHubContext(),
            Options.Create(new GameOptions
            {
                AdminCode = "admin",
                AiMoveDelayMilliseconds = aiMoveDelayMilliseconds
            }),
            NullLogger<GameSessionService>.Instance);

    private static Card ToCard(Kartenreihen.Api.Contracts.CardView card) =>
        new(Enum.Parse<CardSuit>(card.Suit), Enum.Parse<CardRank>(card.Rank));

    private sealed class NoOpHubContext : IHubContext<GameHub>
    {
        public IHubClients Clients { get; } = new NoOpHubClients();

        public IGroupManager Groups { get; } = new NoOpGroupManager();
    }

    private sealed class NoOpHubClients : IHubClients
    {
        private static readonly IClientProxy Proxy = new NoOpClientProxy();

        public IClientProxy All => Proxy;

        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => Proxy;

        public IClientProxy Client(string connectionId) => Proxy;

        public IClientProxy Clients(IReadOnlyList<string> connectionIds) => Proxy;

        public IClientProxy Group(string groupName) => Proxy;

        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => Proxy;

        public IClientProxy Groups(IReadOnlyList<string> groupNames) => Proxy;

        public IClientProxy User(string userId) => Proxy;

        public IClientProxy Users(IReadOnlyList<string> userIds) => Proxy;
    }

    private sealed class NoOpClientProxy : IClientProxy
    {
        public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class NoOpGroupManager : IGroupManager
    {
        public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}

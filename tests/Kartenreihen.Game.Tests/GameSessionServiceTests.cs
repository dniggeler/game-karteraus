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

        await service.StartGameAsync(adminSession.Token, 3);

        var chooserSnapshot = service.RestorePlayerSession(playerSession.Token).Snapshot;
        var chosenRank = chooserSnapshot.ViewerHand[0].Rank;
        var afterRankSelection = await service.SelectStartRankAsync(
            playerSession.Token,
            Enum.Parse<CardRank>(chosenRank));

        var playedCard = afterRankSelection.PlayableCards[0];
        var immediateSnapshot = await service.PlayCardsAsync(playerSession.Token, [ToCard(playedCard)]);

        var activeAi = immediateSnapshot.Players.Single(player => player.IsCurrentTurn);
        Assert.Equal("Ai", activeAi.Kind);
        Assert.Equal(2, immediateSnapshot.CurrentRound!.Actions.Count);

        await Task.Delay(80);

        var delayedSnapshot = service.RestorePlayerSession(playerSession.Token).Snapshot;
        Assert.True(delayedSnapshot.CurrentRound!.Actions.Count >= 3);
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

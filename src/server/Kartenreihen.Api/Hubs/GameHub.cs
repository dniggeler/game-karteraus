using Microsoft.AspNetCore.SignalR;

namespace Kartenreihen.Api.Hubs;

public sealed class GameHub : Hub
{
    public Task Subscribe() => Groups.AddToGroupAsync(Context.ConnectionId, "game");
}

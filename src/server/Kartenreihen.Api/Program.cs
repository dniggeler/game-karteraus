using Kartenreihen.Api;
using Kartenreihen.Api.Contracts;
using Kartenreihen.Api.Hubs;
using Kartenreihen.Api.Services;
using Kartenreihen.Game;

var builder = WebApplication.CreateBuilder(args);
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.Services.Configure<GameOptions>(builder.Configuration.GetSection("Game"));
builder.Services.AddOpenApi();
builder.Services.AddSignalR();
builder.Services.AddSingleton<GameSessionService>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("client", policy =>
    {
        policy.AllowAnyHeader().AllowAnyMethod();

        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins).AllowCredentials();
        }
    });
});

var app = builder.Build();
var clientAppIndexPath = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "index.html");
var hasClientApp = File.Exists(clientAppIndexPath);

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (hasClientApp)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseCors("client");

app.MapPost("/api/session/player", async (PlayerJoinRequest request, GameSessionService service) =>
    await ExecuteAsync(() => service.JoinPlayerAsync(request.Name)));

app.MapGet("/api/session/player/{token}", (string token, GameSessionService service) =>
    Execute(() => service.RestorePlayerSession(token)));

app.MapPost("/api/session/admin", async (AdminLoginRequest request, GameSessionService service) =>
    await ExecuteAsync(() => service.LoginAdminAsync(request.Code)));

app.MapGet("/api/session/admin/{token}", (string token, GameSessionService service) =>
    Execute(() => service.RestoreAdminSession(token)));

app.MapPost("/api/admin/start", async (StartGameRequest request, GameSessionService service) =>
    await ExecuteAsync(() => service.StartGameAsync(request.AdminToken, request.TargetPlayerCount)));

app.MapPost("/api/admin/end", async (EndGameRequest request, GameSessionService service) =>
    await ExecuteAsync(() => service.EndGameAsync(request.AdminToken)));

app.MapPost("/api/admin/reset", async (ResetGameRequest request, GameSessionService service) =>
    await ExecuteAsync(() => service.ResetAsync(request.AdminToken)));

app.MapPost("/api/game/play", async (PlayCardsRequest request, GameSessionService service) =>
{
    try
    {
        var cards = request.Cards.Select(ParseCard).ToList();
        return await ExecuteAsync(() => service.PlayCardsAsync(request.PlayerToken, cards));
    }
    catch (InvalidOperationException exception)
    {
        return Results.BadRequest(new { error = exception.Message });
    }
});

app.MapPost("/api/game/pass", async (PassTurnRequest request, GameSessionService service) =>
    await ExecuteAsync(() => service.PassAsync(request.PlayerToken)));

app.MapHub<GameHub>("/hubs/game");

if (hasClientApp)
{
    app.MapFallbackToFile("index.html");
}

app.Run();

static IResult Execute<T>(Func<T> action)
{
    try
    {
        return Results.Ok(action());
    }
    catch (InvalidOperationException exception)
    {
        return Results.BadRequest(new { error = exception.Message });
    }
}

static async Task<IResult> ExecuteAsync<T>(Func<Task<T>> action)
{
    try
    {
        return Results.Ok(await action());
    }
    catch (InvalidOperationException exception)
    {
        return Results.BadRequest(new { error = exception.Message });
    }
}

static Card ParseCard(CardRequest request)
{
    if (!Enum.TryParse<CardSuit>(request.Suit, ignoreCase: true, out var suit))
    {
        throw new InvalidOperationException("Ungueltige Kartenfarbe.");
    }

    if (!Enum.TryParse<CardRank>(request.Rank, ignoreCase: true, out var rank))
    {
        throw new InvalidOperationException("Ungueltiger Kartenwert.");
    }

    return new Card(suit, rank);
}

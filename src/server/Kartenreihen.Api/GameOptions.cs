namespace Kartenreihen.Api;

public sealed class GameOptions
{
    public string AdminCode { get; set; } = "kartenreihen-admin";
    public int AiMoveDelayMilliseconds { get; set; } = 1200;
}

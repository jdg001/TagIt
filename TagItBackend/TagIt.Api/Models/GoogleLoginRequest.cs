namespace TagIt.Api.Models;

public class GoogleLoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string? Password { get; set; }
}

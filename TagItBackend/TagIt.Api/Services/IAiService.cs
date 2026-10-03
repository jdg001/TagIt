namespace TagIt.Api.Services;
public interface IAiService
{
    Task<string> GenerateContentAsync(string prompt, byte[]? imageBytes = null);
}

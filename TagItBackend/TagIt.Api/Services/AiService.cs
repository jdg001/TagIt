using System.Text;
using System.Text.Json;

namespace TagIt.Api.Services;
public class AiService : IAiService
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;

    public AiService(IConfiguration configuration, HttpClient httpClient)
    {
        _configuration = configuration;
        _httpClient = httpClient;
    }

    public async Task<string> GenerateContentAsync(string prompt, byte[]? imageBytes = null)
    {
        var apiKey = _configuration["Gemini:ApiKey"] ?? throw new InvalidOperationException("Gemini API Key missing");

        var requestPayload = new
        {
            model = "gemini-1.5",
            prompt = prompt,
            image = imageBytes != null ? Convert.ToBase64String(imageBytes) : null
        };

        var requestContent = new StringContent(JsonSerializer.Serialize(requestPayload), Encoding.UTF8, "application/json");
        _httpClient.DefaultRequestHeaders.Clear();
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

        var response = await _httpClient.PostAsync("https://gemini-api-endpoint/v1/generate", requestContent);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        return json;
    }
}


namespace TagIt.Api.Models;

public class GenerateLabelRequest
{
    public int TemplateId { get; set; }
    public Dictionary<string, object> Data { get; set; } = [];
}

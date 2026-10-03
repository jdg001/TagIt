namespace TagIt.Api.Models;

public class BulkGenerateLabelRequest
{
    public int TemplateId { get; set; }  // ID of the template to use
    public List<Dictionary<string, object>> DataSets { get; set; } = new();
}

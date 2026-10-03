using TagIt.Api.Models;

namespace TagIt.Api.Services;
public interface ILabelAiService
{
    Task<LabelSchema> ExtractTemplateAsync(byte[] imageBytes);
    Task<LabelSchema> GenerateFromPromptAsync(LabelPromptRequest request);
}

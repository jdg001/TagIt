using TagIt.Api.Models;

namespace TagIt.Api.Providers;

public interface ILabelProvider
{
    /// <summary>
    /// Get template by ID for label generation
    /// </summary>
    /// <param name="templateId">Template ID</param>
    /// <returns>Template if found, null otherwise</returns>
    Task<LabelTemplate?> GetTemplateForGenerationAsync(int templateId);

    /// <summary>
    /// Validate that template exists
    /// </summary>
    /// <param name="templateId">Template ID</param>
    /// <returns>True if template exists</returns>
    Task<bool> ValidateTemplateExistsAsync(int templateId);
}

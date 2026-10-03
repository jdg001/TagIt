using TagIt.Api.Models;

namespace TagIt.Api.Providers;

public interface ITemplateProvider
{
    /// <summary>
    /// Get all label templates
    /// </summary>
    Task<IEnumerable<LabelTemplate>> GetAllTemplatesAsync();

    /// <summary>
    /// Get template by ID
    /// </summary>
    Task<LabelTemplate?> GetTemplateByIdAsync(int templateId);

    /// <summary>
    /// Create new template
    /// </summary>
    Task<LabelTemplate> CreateTemplateAsync(LabelTemplate template);

    /// <summary>
    /// Update existing template
    /// </summary>
    Task<LabelTemplate> UpdateTemplateAsync(LabelTemplate template);

    /// <summary>
    /// Delete template by ID
    /// </summary>
    Task<bool> DeleteTemplateAsync(int templateId);

    /// <summary>
    /// Check if template exists
    /// </summary>
    Task<bool> TemplateExistsAsync(int templateId);
}

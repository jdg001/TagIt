using Microsoft.EntityFrameworkCore;
using TagIt.Api.Data;
using TagIt.Api.Models;

namespace TagIt.Api.Providers;

public class LabelProvider : ILabelProvider
{
    private readonly AppDb _context;
    private readonly ILogger<LabelProvider> _logger;

    public LabelProvider(AppDb context, ILogger<LabelProvider> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<LabelTemplate?> GetTemplateForGenerationAsync(int templateId)
    {
        try
        {
            _logger.LogInformation("Retrieving template for label generation with ID: {TemplateId}", templateId);
            return await _context.LabelTemplates.FindAsync(templateId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving template for generation with ID: {TemplateId}", templateId);
            throw;
        }
    }

    public async Task<bool> ValidateTemplateExistsAsync(int templateId)
    {
        try
        {
            _logger.LogInformation("Validating template exists with ID: {TemplateId}", templateId);
            return await _context.LabelTemplates.AnyAsync(t => t.TemplateId == templateId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating template exists with ID: {TemplateId}", templateId);
            throw;
        }
    }
}

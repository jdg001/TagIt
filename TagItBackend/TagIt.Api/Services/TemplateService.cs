using TagIt.Api.Models;
using TagIt.Api.Providers;

namespace TagIt.Api.Services;

public class TemplateService : ITemplateService
{
    private readonly ITemplateProvider _templateProvider;
    private readonly ILogger<TemplateService> _logger;

    public TemplateService(ITemplateProvider templateProvider, ILogger<TemplateService> logger)
    {
        _templateProvider = templateProvider;
        _logger = logger;
    }

    public async Task<IEnumerable<LabelTemplate>> GetAllTemplatesAsync()
    {
        try
        {
            _logger.LogInformation("Getting all templates");
            return await _templateProvider.GetAllTemplatesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all templates");
            throw;
        }
    }

    public async Task<LabelTemplate?> GetTemplateByIdAsync(int templateId)
    {
        try
        {
            _logger.LogInformation("Getting template with ID: {TemplateId}", templateId);
            
            if (templateId <= 0)
            {
                throw new ArgumentException("Template ID must be greater than 0", nameof(templateId));
            }

            return await _templateProvider.GetTemplateByIdAsync(templateId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting template with ID: {TemplateId}", templateId);
            throw;
        }
    }

    public async Task<LabelTemplate> CreateTemplateAsync(LabelTemplate template)
    {
        try
        {
            _logger.LogInformation("Creating template: {TemplateName}", template.Name);
            
            // Validate template
            if (!await ValidateTemplateAsync(template))
            {
                throw new ArgumentException("Template validation failed");
            }

            return await _templateProvider.CreateTemplateAsync(template);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating template: {TemplateName}", template.Name);
            throw;
        }
    }

    public async Task<LabelTemplate> UpdateTemplateAsync(int templateId, LabelTemplate template)
    {
        try
        {
            _logger.LogInformation("Updating template with ID: {TemplateId}", templateId);
            
            if (templateId <= 0)
            {
                throw new ArgumentException("Template ID must be greater than 0", nameof(templateId));
            }

            // Check if template exists
            if (!await _templateProvider.TemplateExistsAsync(templateId))
            {
                throw new InvalidOperationException($"Template with ID {templateId} not found");
            }

            // Validate template
            if (!await ValidateTemplateAsync(template))
            {
                throw new ArgumentException("Template validation failed");
            }

            // Set the template ID to ensure we're updating the correct template
            template.TemplateId = templateId;

            return await _templateProvider.UpdateTemplateAsync(template);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating template with ID: {TemplateId}", templateId);
            throw;
        }
    }

    public async Task<bool> DeleteTemplateAsync(int templateId)
    {
        try
        {
            _logger.LogInformation("Deleting template with ID: {TemplateId}", templateId);
            
            if (templateId <= 0)
            {
                throw new ArgumentException("Template ID must be greater than 0", nameof(templateId));
            }

            return await _templateProvider.DeleteTemplateAsync(templateId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting template with ID: {TemplateId}", templateId);
            throw;
        }
    }

    public async Task<bool> ValidateTemplateAsync(LabelTemplate template)
    {
        try
        {
            if (template == null)
            {
                _logger.LogWarning("Template validation failed: Template is null");
                return false;
            }

            if (string.IsNullOrWhiteSpace(template.Name))
            {
                _logger.LogWarning("Template validation failed: Name is required");
                return false;
            }

            if (template.Name.Length > 200)
            {
                _logger.LogWarning("Template validation failed: Name exceeds 200 characters");
                return false;
            }

            if (string.IsNullOrWhiteSpace(template.JsonSchema))
            {
                _logger.LogWarning("Template validation failed: JsonSchema is required");
                return false;
            }

            if (template.PaperWidth <= 0)
            {
                _logger.LogWarning("Template validation failed: PaperWidth must be greater than 0");
                return false;
            }

            if (template.PaperHeight <= 0)
            {
                _logger.LogWarning("Template validation failed: PaperHeight must be greater than 0");
                return false;
            }

            if (string.IsNullOrWhiteSpace(template.Unit))
            {
                _logger.LogWarning("Template validation failed: Unit is required");
                return false;
            }

            var validUnits = new[] { "inch", "mm", "px" };
            if (!validUnits.Contains(template.Unit.ToLower()))
            {
                _logger.LogWarning("Template validation failed: Unit must be one of: {ValidUnits}", string.Join(", ", validUnits));
                return false;
            }

            _logger.LogInformation("Template validation successful for: {TemplateName}", template.Name);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating template: {TemplateName}", template?.Name);
            return false;
        }
    }
}

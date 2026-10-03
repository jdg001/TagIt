using Microsoft.EntityFrameworkCore;
using TagIt.Api.Data;
using TagIt.Api.Models;

namespace TagIt.Api.Providers;

public class TemplateProvider : ITemplateProvider
{
    private readonly AppDb _context;
    private readonly ILogger<TemplateProvider> _logger;

    public TemplateProvider(AppDb context, ILogger<TemplateProvider> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<IEnumerable<LabelTemplate>> GetAllTemplatesAsync()
    {
        try
        {
            _logger.LogInformation("Retrieving all label templates");
            return await _context.LabelTemplates.ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving all label templates");
            throw;
        }
    }

    public async Task<LabelTemplate?> GetTemplateByIdAsync(int templateId)
    {
        try
        {
            _logger.LogInformation("Retrieving template with ID: {TemplateId}", templateId);
            return await _context.LabelTemplates.FindAsync(templateId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving template with ID: {TemplateId}", templateId);
            throw;
        }
    }

    public async Task<LabelTemplate> CreateTemplateAsync(LabelTemplate template)
    {
        try
        {
            _logger.LogInformation("Creating new template: {TemplateName}", template.Name);
            
            template.CreatedAt = DateTime.UtcNow;
            _context.LabelTemplates.Add(template);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Successfully created template with ID: {TemplateId}", template.TemplateId);
            return template;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating template: {TemplateName}", template.Name);
            throw;
        }
    }

    public async Task<LabelTemplate> UpdateTemplateAsync(LabelTemplate template)
    {
        try
        {
            _logger.LogInformation("Updating template with ID: {TemplateId}", template.TemplateId);
            
            var existingTemplate = await _context.LabelTemplates.FindAsync(template.TemplateId);
            if (existingTemplate == null)
            {
                throw new InvalidOperationException($"Template with ID {template.TemplateId} not found");
            }

            // Update properties
            existingTemplate.Name = template.Name;
            existingTemplate.Description = template.Description;
            existingTemplate.PaperWidth = template.PaperWidth;
            existingTemplate.PaperHeight = template.PaperHeight;
            existingTemplate.Unit = template.Unit;
            existingTemplate.JsonSchema = template.JsonSchema;
            existingTemplate.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Successfully updated template with ID: {TemplateId}", template.TemplateId);
            return existingTemplate;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating template with ID: {TemplateId}", template.TemplateId);
            throw;
        }
    }

    public async Task<bool> DeleteTemplateAsync(int templateId)
    {
        try
        {
            _logger.LogInformation("Deleting template with ID: {TemplateId}", templateId);
            
            var template = await _context.LabelTemplates.FindAsync(templateId);
            if (template == null)
            {
                _logger.LogWarning("Template with ID {TemplateId} not found for deletion", templateId);
                return false;
            }

            // First, delete all related DesignState records
            var designStates = await _context.DesignState
                .Where(ds => ds.TemplateId == templateId)
                .ToListAsync();
            
            if (designStates.Any())
            {
                _logger.LogInformation("Deleting {Count} DesignState records for template ID: {TemplateId}", 
                    designStates.Count, templateId);
                
                // Delete all comments related to these design states
                var designStateIds = designStates.Select(ds => ds.DesignStateId).ToList();
                var comments = await _context.Comments
                    .Where(c => designStateIds.Contains(c.DesignStateId))
                    .ToListAsync();
                
                if (comments.Any())
                {
                    _logger.LogInformation("Deleting {Count} Comments for template ID: {TemplateId}", 
                        comments.Count, templateId);
                    _context.Comments.RemoveRange(comments);
                }
                
                // Delete all design states
                _context.DesignState.RemoveRange(designStates);
            }

            // Finally, delete the template itself
            _context.LabelTemplates.Remove(template);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Successfully deleted template with ID: {TemplateId} and all related records", templateId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting template with ID: {TemplateId}", templateId);
            throw;
        }
    }

    public async Task<bool> TemplateExistsAsync(int templateId)
    {
        try
        {
            return await _context.LabelTemplates.AnyAsync(t => t.TemplateId == templateId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking if template exists with ID: {TemplateId}", templateId);
            throw;
        }
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TagIt.Api.Interfaces;
using TagIt.Api.Models;
using TagIt.Api.Services;

namespace TagIt.Api.Controllers;

[ApiController]
[Route("api/templates")]
[Authorize]
public class TemplateController : ControllerBase
{
    private readonly ITemplateService _templateService;
    private readonly ILogger<TemplateController> _logger;

    public TemplateController(ITemplateService templateService, ILogger<TemplateController> logger)
    {
        _templateService = templateService;
        _logger = logger;
    }

    /// <summary>
    /// Get all label templates
    /// </summary>
    /// <returns>List of all label templates</returns>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<LabelTemplate>>> GetAllTemplates()
    {
        try
        {
            _logger.LogInformation("Getting all templates");
            var templates = await _templateService.GetAllTemplatesAsync();
            return Ok(templates);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all templates");
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get template by ID
    /// </summary>
    /// <param name="id">Template ID</param>
    /// <returns>Template details</returns>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<LabelTemplate>> GetTemplateById(int id)
    {
        try
        {
            _logger.LogInformation("Getting template with ID: {TemplateId}", id);
            
            var template = await _templateService.GetTemplateByIdAsync(id);
            if (template == null)
            {
                _logger.LogWarning("Template with ID {TemplateId} not found", id);
                return NotFound($"Template with ID {id} not found");
            }

            return Ok(template);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning("Invalid request for template ID: {TemplateId}, Error: {Error}", id, ex.Message);
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting template with ID: {TemplateId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Create new template
    /// </summary>
    /// <param name="template">Template data</param>
    /// <returns>Created template</returns>
    [HttpPost]
    public async Task<ActionResult<LabelTemplate>> CreateTemplate([FromBody] LabelTemplate template)
    {
        try
        {
            _logger.LogInformation("Creating new template: {TemplateName}", template.Name);
            
            var createdTemplate = await _templateService.CreateTemplateAsync(template);
            
            _logger.LogInformation("Successfully created template with ID: {TemplateId}", createdTemplate.TemplateId);
            return CreatedAtAction(nameof(GetTemplateById), new { id = createdTemplate.TemplateId }, createdTemplate);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning("Invalid request for creating template: {TemplateName}, Error: {Error}", template.Name, ex.Message);
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating template: {TemplateName}", template.Name);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Update existing template
    /// </summary>
    /// <param name="id">Template ID</param>
    /// <param name="template">Updated template data</param>
    /// <returns>Updated template</returns>
    [HttpPut("{id:int}")]
    public async Task<ActionResult<LabelTemplate>> UpdateTemplate(int id, [FromBody] LabelTemplate template)
    {
        try
        {
            _logger.LogInformation("Updating template with ID: {TemplateId}", id);
            
            var updatedTemplate = await _templateService.UpdateTemplateAsync(id, template);
            
            _logger.LogInformation("Successfully updated template with ID: {TemplateId}", id);
            return Ok(updatedTemplate);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning("Invalid request for updating template ID: {TemplateId}, Error: {Error}", id, ex.Message);
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Template not found for update: {TemplateId}, Error: {Error}", id, ex.Message);
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating template with ID: {TemplateId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Delete template
    /// </summary>
    /// <param name="id">Template ID</param>
    /// <returns>No content if successful</returns>
    [HttpDelete("{id:int}")]
    public async Task<ActionResult> DeleteTemplate(int id)
    {
        try
        {
            _logger.LogInformation("Deleting template with ID: {TemplateId}", id);
            
            var deleted = await _templateService.DeleteTemplateAsync(id);
            if (!deleted)
            {
                _logger.LogWarning("Template with ID {TemplateId} not found for deletion", id);
                return NotFound($"Template with ID {id} not found");
            }

            _logger.LogInformation("Successfully deleted template with ID: {TemplateId}", id);
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning("Invalid request for deleting template ID: {TemplateId}, Error: {Error}", id, ex.Message);
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting template with ID: {TemplateId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpGet("{id:int}/thumbnail")]
    public async Task<IActionResult> GetTemplateThumbnail(int id, [FromQuery] int width = 200, [FromQuery] int height = 200)
    {
        try
        {
            var thumbnailService = HttpContext.RequestServices.GetRequiredService<ITemplateThumbnailService>();
            var thumbnailBytes = await thumbnailService.GenerateThumbnailAsync(id, width, height);

            return File(thumbnailBytes, "image/png");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating thumbnail for template {TemplateId}", id);
            return StatusCode(500, "Internal server error");
        }
    }
}

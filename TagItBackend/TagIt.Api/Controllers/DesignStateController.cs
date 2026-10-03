using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TagIt.Api.Models;
using TagIt.Api.Services;

namespace TagIt.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DesignStateController : ControllerBase
{
    private readonly IDesignStateService _designStateService;
    private readonly ILogger<DesignStateController> _logger;
    private readonly IUserContextService _userContextService;

    public DesignStateController(IDesignStateService designStateService, ILogger<DesignStateController> logger, IUserContextService userContextService)
    {
        _designStateService = designStateService;
        _logger = logger;
        _userContextService = userContextService;
    }

    /// <summary>
    /// Get all design states
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<DesignStateDto>>> GetAllDesignStates()
    {
        try
        {
            var designStates = await _designStateService.GetAllDesignStatesAsync();
            return Ok(designStates);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all design states");
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get design state by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<DesignStateDto>> GetDesignStateById(int id)
    {
        try
        {
            var designState = await _designStateService.GetDesignStateByIdAsync(id);
            if (designState == null)
                return NotFound($"Design state with ID {id} not found");

            return Ok(designState);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting design state by ID: {DesignStateId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Create new design state
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<DesignStateDto>> CreateDesignState([FromBody] CreateDesignStateRequest request)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            var designState = await _designStateService.CreateDesignStateAsync(request, currentUserId);
            return CreatedAtAction(nameof(GetDesignStateById), new { id = designState.DesignStateId }, designState);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating design state for template: {TemplateId}", request.TemplateId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Update design state
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<DesignStateDto>> UpdateDesignState(int id, [FromBody] UpdateDesignStateRequest request)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            var designState = await _designStateService.UpdateDesignStateAsync(id, request, currentUserId);
            return Ok(designState);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating design state: {DesignStateId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Delete design state
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteDesignState(int id)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            var deleted = await _designStateService.DeleteDesignStateAsync(id, currentUserId);
            if (!deleted)
                return NotFound($"Design state with ID {id} not found");

            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting design state: {DesignStateId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get current template state
    /// </summary>
    [HttpGet("templates/{templateId}/current")]
    public async Task<ActionResult<DesignStateDto>> GetCurrentTemplateState(int templateId)
    {
        try
        {
            var designState = await _designStateService.GetCurrentTemplateStateAsync(templateId);
            if (designState == null)
                return NotFound($"No active design state found for template {templateId}");

            return Ok(designState);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting current template state for template: {TemplateId}", templateId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get template states (version history)
    /// </summary>
    [HttpGet("templates/{templateId}/states")]
    public async Task<ActionResult<IEnumerable<DesignStateDto>>> GetTemplateStates(int templateId)
    {
        try
        {
            var states = await _designStateService.GetTemplateStatesAsync(templateId);
            return Ok(states);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting template states for template: {TemplateId}", templateId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Submit template for review
    /// </summary>
    [HttpPost("{id}/submit-review")]
    public async Task<ActionResult<DesignStateDto>> SubmitForReview(int id, [FromBody] SubmitForReviewRequest request)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            // Ensure the request DesignStateId matches the route parameter
            request.DesignStateId = id;

            var designState = await _designStateService.SubmitForReviewAsync(request, currentUserId);
            return Ok(designState);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting for review: {DesignStateId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Approve template
    /// </summary>
    [HttpPost("{id}/approve")]
    public async Task<ActionResult<DesignStateDto>> ApproveTemplate(int id, [FromBody] ApproveTemplateRequest request)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            // Ensure the request DesignStateId matches the route parameter
            request.DesignStateId = id;

            var designState = await _designStateService.ApproveTemplateAsync(request, currentUserId);
            return Ok(designState);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error approving template: {DesignStateId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Reject template
    /// </summary>
    [HttpPost("{id}/reject")]
    public async Task<ActionResult<DesignStateDto>> RejectTemplate(int id, [FromBody] RejectTemplateRequest request)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            // Ensure the request DesignStateId matches the route parameter
            request.DesignStateId = id;

            var designState = await _designStateService.RejectTemplateAsync(request, currentUserId);
            return Ok(designState);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rejecting template: {DesignStateId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Publish template
    /// </summary>
    [HttpPost("{id}/publish")]
    public async Task<ActionResult<DesignStateDto>> PublishTemplate(int id, [FromBody] PublishTemplateRequest request)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            // Ensure the request DesignStateId matches the route parameter
            request.DesignStateId = id;

            var designState = await _designStateService.PublishTemplateAsync(request, currentUserId);
            return Ok(designState);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing template: {DesignStateId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get designer dashboard
    /// </summary>
    [HttpGet("dashboard/designer/{designerId}")]
    public async Task<ActionResult<IEnumerable<DesignStateDto>>> GetDesignerDashboard(int designerId)
    {
        try
        {
            var dashboard = await _designStateService.GetDesignerDashboardAsync(designerId);
            return Ok(dashboard);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting designer dashboard for designer: {DesignerId}", designerId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get reviewer dashboard
    /// </summary>
    [HttpGet("dashboard/reviewer/{reviewerId}")]
    public async Task<ActionResult<IEnumerable<DesignStateDto>>> GetReviewerDashboard(int reviewerId)
    {
        try
        {
            var dashboard = await _designStateService.GetReviewerDashboardAsync(reviewerId);
            return Ok(dashboard);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting reviewer dashboard for reviewer: {ReviewerId}", reviewerId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get admin dashboard
    /// </summary>
    [HttpGet("dashboard/admin")]
    public async Task<ActionResult<DashboardStatsDto>> GetAdminDashboard()
    {
        try
        {
            var dashboard = await _designStateService.GetAdminDashboardAsync();
            return Ok(dashboard);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting admin dashboard");
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Assign reviewer to design state
    /// </summary>
    [HttpPost("{id}/assign")]
    public async Task<ActionResult<DesignStateDto>> AssignReviewer(int id, [FromBody] AssignReviewerRequest request)
    {
        try
        {
            // Set the DesignStateId from the route parameter
            request.DesignStateId = id;
            
            var currentUserId = _userContextService.GetCurrentUserId();

            var designState = await _designStateService.AssignReviewerAsync(request, currentUserId);
            return Ok(designState);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning reviewer to design state: {DesignStateId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Unassign reviewer from design state
    /// </summary>
    [HttpPost("{id}/unassign")]
    public async Task<ActionResult<DesignStateDto>> UnassignReviewer(int id, [FromBody] UnassignReviewerRequest request)
    {
        try
        {
            // Set the DesignStateId from the route parameter
            request.DesignStateId = id;
            
            var currentUserId = _userContextService.GetCurrentUserId();

            var designState = await _designStateService.UnassignReviewerAsync(request, currentUserId);
            return Ok(designState);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unassigning reviewer from design state: {DesignStateId}", id);
            return StatusCode(500, "Internal server error");
        }
    }
}

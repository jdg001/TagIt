using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TagIt.Api.Models;
using TagIt.Api.Services;

namespace TagIt.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(IDashboardService dashboardService, ILogger<DashboardController> logger)
    {
        _dashboardService = dashboardService;
        _logger = logger;
    }

    /// <summary>
    /// Get templates by library type for dashboard
    /// </summary>
    [HttpGet("templates/library/{libraryType}/{userId:int}")]
    public async Task<ActionResult<IEnumerable<DashboardTemplateDto>>> GetTemplatesByLibrary(string libraryType, int userId)
    {
        try
        {
            var templates = await _dashboardService.GetTemplatesByLibraryAsync(libraryType, userId);
            return Ok(templates);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting templates by library type: {LibraryType} for user: {UserId}", libraryType, userId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get reviewers list
    /// </summary>
    [HttpGet("reviewers")]
    public async Task<ActionResult<IEnumerable<ReviewerDto>>> GetReviewers()
    {
        try
        {
            var reviewers = await _dashboardService.GetReviewersAsync();
            return Ok(reviewers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting reviewers list");
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get dashboard statistics
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<DashboardStatsDto>> GetDashboardStats()
    {
        try
        {
            var stats = await _dashboardService.GetDashboardStatsAsync();
            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting dashboard statistics");
            return StatusCode(500, "Internal server error");
        }
    }
}

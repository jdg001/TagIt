using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using TagIt.Api.Models;
using TagIt.Api.Services;

namespace TagIt.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CollaborationController : ControllerBase
{
    private readonly ICollaborationService _collaborationService;
    private readonly ILogger<CollaborationController> _logger;

    public CollaborationController(ICollaborationService collaborationService, ILogger<CollaborationController> logger)
    {
        _collaborationService = collaborationService;
        _logger = logger;
    }

    [HttpPost("join-session")]
    public async Task<ActionResult<JoinSessionResponse>> JoinSession([FromBody] JoinSessionRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            var userName = GetCurrentUserName();
            var userEmail = GetCurrentUserEmail();

            var result = await _collaborationService.JoinSessionAsync(
                HttpContext.Connection.Id, 
                userId, 
                userName, 
                userEmail, 
                request.TemplateId, 
                request.SessionId);

            if (result.Success)
            {
                return Ok(result);
            }
            else
            {
                return BadRequest(result);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error joining collaboration session");
            return StatusCode(500, new JoinSessionResponse
            {
                Success = false,
                ErrorMessage = "An error occurred while joining the session"
            });
        }
    }

    [HttpPost("leave-session")]
    public async Task<ActionResult> LeaveSession([FromBody] LeaveSessionRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            var userInfo = await _collaborationService.LeaveSessionAsync(
                HttpContext.Connection.Id, 
                userId, 
                request.SessionId);

            if (userInfo != null)
            {
                return Ok(new { message = "Successfully left the session" });
            }
            else
            {
                return BadRequest(new { message = "Failed to leave the session" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error leaving collaboration session");
            return StatusCode(500, new { message = "An error occurred while leaving the session" });
        }
    }

    [HttpGet("session/{sessionId}/users")]
    public async Task<ActionResult<List<CollaborationUser>>> GetSessionUsers(string sessionId)
    {
        try
        {
            var users = await _collaborationService.GetSessionUsersAsync(sessionId);
            return Ok(users);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting session users for session {SessionId}", sessionId);
            return StatusCode(500, new { message = "An error occurred while getting session users" });
        }
    }

    [HttpGet("session/{sessionId}")]
    public async Task<ActionResult<CollaborationSession>> GetSession(string sessionId)
    {
        try
        {
            var session = await _collaborationService.GetSessionAsync(sessionId);
            if (session != null)
            {
                return Ok(session);
            }
            else
            {
                return NotFound(new { message = "Session not found" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting session {SessionId}", sessionId);
            return StatusCode(500, new { message = "An error occurred while getting the session" });
        }
    }

    [HttpGet("session/{sessionId}/canvas-state")]
    public async Task<ActionResult<CanvasState>> GetCanvasState(string sessionId)
    {
        try
        {
            var canvasState = await _collaborationService.GetCanvasStateAsync(sessionId);
            if (canvasState != null)
            {
                return Ok(canvasState);
            }
            else
            {
                return NotFound(new { message = "Canvas state not found" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting canvas state for session {SessionId}", sessionId);
            return StatusCode(500, new { message = "An error occurred while getting the canvas state" });
        }
    }

    [HttpGet("sessions/template/{templateId}")]
    public async Task<ActionResult<CollaborationSession?>> GetSessionByTemplateId(int templateId)
    {
        try
        {
            var session = await _collaborationService.GetSessionByTemplateIdAsync(templateId);
            return Ok(session);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting session for template {TemplateId}", templateId);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpGet("sessions/active")]
    public async Task<ActionResult<List<CollaborationSession>>> GetActiveSessions()
    {
        try
        {
            var sessions = await _collaborationService.GetActiveSessionsAsync();
            return Ok(sessions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting active sessions");
            return StatusCode(500, "Internal server error");
        }
    }

    private int GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : 0;
    }

    private string GetCurrentUserName()
    {
        return User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Unknown User";
    }

    private string GetCurrentUserEmail()
    {
        return User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "unknown@example.com";
    }
}

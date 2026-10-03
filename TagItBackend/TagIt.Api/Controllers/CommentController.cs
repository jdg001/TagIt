using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TagIt.Api.Models;
using TagIt.Api.Services;

namespace TagIt.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CommentController : ControllerBase
{
    private readonly ICommentService _commentService;
    private readonly ILogger<CommentController> _logger;
    private readonly IUserContextService _userContextService;

    public CommentController(ICommentService commentService, ILogger<CommentController> logger, IUserContextService userContextService)
    {
        _commentService = commentService;
        _logger = logger;
        _userContextService = userContextService;
    }

    /// <summary>
    /// Get all comments for a design state
    /// </summary>
    [HttpGet("designstate/{designStateId}")]
    public async Task<ActionResult<IEnumerable<CommentDto>>> GetCommentsByDesignStateId(int designStateId)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            var comments = await _commentService.GetCommentsByDesignStateIdAsync(designStateId, currentUserId);
            return Ok(comments);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting comments for design state: {DesignStateId}", designStateId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get a specific comment by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<CommentDto>> GetComment(int id)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            var comment = await _commentService.GetCommentByIdAsync(id, currentUserId);
            if (comment == null)
            {
                return NotFound();
            }

            return Ok(comment);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting comment: {CommentId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Create a new comment
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<CommentDto>> CreateComment([FromBody] CreateCommentRequest request)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            var comment = await _commentService.CreateCommentAsync(request, currentUserId);
            return CreatedAtAction(nameof(GetComment), new { id = comment.CommentId }, comment);
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
            _logger.LogError(ex, "Error creating comment for design state: {DesignStateId}", request.DesignStateId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Update an existing comment
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<CommentDto>> UpdateComment(int id, [FromBody] UpdateCommentRequest request)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            // Ensure the request ID matches the route parameter
            request.CommentId = id;

            var comment = await _commentService.UpdateCommentAsync(request, currentUserId);
            return Ok(comment);
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
            _logger.LogError(ex, "Error updating comment: {CommentId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Delete a comment (hard delete)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteComment(int id)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            var request = new DeleteCommentRequest
            {
                CommentId = id
            };

            var deleted = await _commentService.DeleteCommentAsync(request, currentUserId);
            if (!deleted)
            {
                return NotFound();
            }

            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting comment: {CommentId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Bulk create comments (for rejection workflow)
    /// </summary>
    [HttpPost("bulk")]
    public async Task<ActionResult<IEnumerable<CommentDto>>> BulkCreateComments([FromBody] BulkCreateCommentsRequest request)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            var comments = await _commentService.BulkCreateCommentsAsync(request, currentUserId);
            return Ok(comments);
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
            _logger.LogError(ex, "Error bulk creating comments for design state: {DesignStateId}", request.DesignStateId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Check if design state has unresolved comments
    /// </summary>
    [HttpGet("designstate/{designStateId}/unresolved")]
    public async Task<ActionResult<bool>> HasUnresolvedComments(int designStateId)
    {
        try
        {
            var hasUnresolved = await _commentService.HasUnresolvedCommentsAsync(designStateId);
            return Ok(hasUnresolved);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking unresolved comments for design state: {DesignStateId}", designStateId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get count of unresolved comments for a design state
    /// </summary>
    [HttpGet("designstate/{designStateId}/unresolved/count")]
    public async Task<ActionResult<int>> GetUnresolvedCommentCount(int designStateId)
    {
        try
        {
            var count = await _commentService.GetUnresolvedCommentCountAsync(designStateId);
            return Ok(count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting unresolved comment count for design state: {DesignStateId}", designStateId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Resolve a comment (designer response)
    /// </summary>
    [HttpPut("{id}/resolve")]
    public async Task<ActionResult> ResolveComment(int id, [FromBody] ResolveCommentRequest request)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            // Ensure the comment ID in the URL matches the request
            request.CommentId = id;

            var resolved = await _commentService.ResolveCommentAsync(request, currentUserId);
            if (!resolved)
            {
                return NotFound();
            }

            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resolving comment: {CommentId}", id);
            return StatusCode(500, "Internal server error");
        }
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TagIt.Api.Models;
using TagIt.Api.Models.Users;
using TagIt.Api.Services;

namespace TagIt.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RoleController : ControllerBase
{
    private readonly IRoleService _roleService;
    private readonly ILogger<RoleController> _logger;
    private readonly IUserContextService _userContextService;

    public RoleController(IRoleService roleService, ILogger<RoleController> logger, IUserContextService userContextService)
    {
        _roleService = roleService;
        _logger = logger;
        _userContextService = userContextService;
    }

    /// <summary>
    /// Get all roles
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<RoleDto>>> GetAllRoles()
    {
        try
        {
            var roles = await _roleService.GetAllRolesAsync();
            return Ok(roles);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all roles");
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get role by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<RoleDto>> GetRoleById(int id)
    {
        try
        {
            var role = await _roleService.GetRoleByIdAsync(id);
            if (role == null)
                return NotFound($"Role with ID {id} not found");

            return Ok(role);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting role by ID: {RoleId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Create new role (Admin only)
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<RoleDto>> CreateRole([FromBody] CreateRoleRequest request)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            var role = await _roleService.CreateRoleAsync(request, currentUserId);
            return CreatedAtAction(nameof(GetRoleById), new { id = role.RoleId }, role);
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
            _logger.LogError(ex, "Error creating role: {RoleName}", request.RoleName);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Update role (Admin only)
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<RoleDto>> UpdateRole(int id, [FromBody] UpdateRoleRequest request)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            var role = await _roleService.UpdateRoleAsync(id, request, currentUserId);
            return Ok(role);
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
            _logger.LogError(ex, "Error updating role: {RoleId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Delete role (Admin only)
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> DeleteRole(int id)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            var deleted = await _roleService.DeleteRoleAsync(id, currentUserId);
            if (!deleted)
                return NotFound($"Role with ID {id} not found");

            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting role: {RoleId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get user roles
    /// </summary>
    [HttpGet("users/{userId}")]
    public async Task<ActionResult<IEnumerable<UserRoleDto>>> GetUserRoles(int userId)
    {
        try
        {
            var userRoles = await _roleService.GetUserRolesAsync(userId);
            return Ok(userRoles);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user roles for user: {UserId}", userId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Assign role to user (Admin only)
    /// </summary>
    [HttpPost("users/{userId}/assign")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<UserRoleDto>> AssignUserRole(int userId, [FromBody] AssignUserRoleRequest request)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            // Ensure the request UserId matches the route parameter
            request.UserId = userId;

            var userRole = await _roleService.AssignUserRoleAsync(request, currentUserId);
            return Ok(userRole);
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
            _logger.LogError(ex, "Error assigning user role: UserId={UserId}, RoleId={RoleId}", userId, request.RoleId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Remove role from user (Admin only)
    /// </summary>
    [HttpDelete("users/{userId}/roles/{roleId}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> RemoveUserRole(int userId, int roleId)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();

            var removed = await _roleService.RemoveUserRoleAsync(userId, roleId, currentUserId);
            if (!removed)
                return NotFound($"User role not found");

            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing user role: UserId={UserId}, RoleId={RoleId}", userId, roleId);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Get users by role
    /// </summary>
    [HttpGet("{roleId}/users")]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetUsersByRole(int roleId)
    {
        try
        {
            var users = await _roleService.GetUsersByRoleAsync(roleId);
            return Ok(users);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting users by role: {RoleId}", roleId);
            return StatusCode(500, "Internal server error");
        }
    }
}

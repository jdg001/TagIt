using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TagIt.Api.Models.Users;
using TagIt.Api.Services.Users;
using TagIt.Api.Services;

namespace TagIt.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class UsersController(IUserService service, IUserContextService userContextService) : ControllerBase
{
    private readonly IUserService _service = service;
    private readonly IUserContextService _userContextService = userContextService;

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<PagedResult<UserDto>>> GetAll(
        [FromQuery] Guid? tenantId,
        [FromQuery] string? search,
        [FromQuery] bool? isActive,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var result = await _service.GetAllAsync(tenantId, search, isActive, skip, take, ct);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<UserDto>> GetById(int id, CancellationToken ct = default)
    {
        var dto = await _service.GetByIdAsync(id, ct);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpGet("by-email")]
    [AllowAnonymous]
    public async Task<ActionResult<UserDto>> GetByEmail([FromQuery] string email, CancellationToken ct = default)
    {
        var dto = await _service.GetByEmailAsync(email, ct);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<UserDto>> Create([FromBody] UserCreateDto dto, CancellationToken ct = default)
    {
        var (result, error) = await _service.CreateAsync(dto, ct);
        if (error == "InvalidTenant") return BadRequest(new { message = "Invalid tenant id." });
        if (error == "DuplicateEmail") return Conflict(new { message = "Email already exists in this tenant." });

        return CreatedAtAction(nameof(GetById), new { id = result!.UserId }, result);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<UserDto>> Update(int id, [FromBody] UserUpdateDto dto, CancellationToken ct = default)
    {
        var (result, error) = await _service.UpdateAsync(id, dto, ct);
        if (error == "NotFound") return NotFound();
        if (error == "DuplicateEmail") return Conflict(new { message = "Email already exists in this tenant." });
        return Ok(result);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct = default)
    {
        try
        {
            var currentUserId = _userContextService.GetCurrentUserId();
            
            // Prevent admin from deleting themselves
            if (id == currentUserId)
            {
                return BadRequest(new { message = "You cannot delete your own account" });
            }
            
            var ok = await _service.DeleteAsync(id, ct);
            return ok ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
    }

    [HttpPost("{id:int}:activate")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Activate(int id, CancellationToken ct = default)
    {
        var ok = await _service.ActivateAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{id:int}:deactivate")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Deactivate(int id, CancellationToken ct = default)
    {
        var ok = await _service.DeactivateAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }

    [HttpGet("search")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<PagedResult<UserWithRolesDto>>> SearchUsers(
        [FromQuery] string? search,
        [FromQuery] string[]? roles,
        [FromQuery] bool? isActive,
        [FromQuery] DateTime? createdAfter,
        [FromQuery] DateTime? createdBefore,
        [FromQuery] Guid? tenantId,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var filters = new UserSearchFilters
        {
            Search = search,
            Roles = roles?.ToList(),
            IsActive = isActive,
            CreatedAfter = createdAfter,
            CreatedBefore = createdBefore,
            Skip = skip,
            Take = take,
            TenantId = tenantId
        };

        var result = await _service.SearchUsersAsync(filters, ct);
        return Ok(result);
    }

    [HttpPost("{id:int}/roles/bulk")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> AssignMultipleRoles(int id, [FromBody] AssignMultipleRolesRequest request, CancellationToken ct = default)
    {
        var success = await _service.AssignMultipleRolesAsync(id, request, ct);
        return success ? NoContent() : NotFound();
    }

    [HttpDelete("{id:int}/roles/{roleId:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> RemoveUserRole(int id, int roleId, CancellationToken ct = default)
    {
        var success = await _service.RemoveUserRoleAsync(id, roleId, ct);
        return success ? NoContent() : NotFound();
    }
}

using TagIt.Api.Models;
using TagIt.Api.Models.Users;
using TagIt.Api.Providers;

namespace TagIt.Api.Services;

public class RoleService : IRoleService
{
    private readonly IRoleProvider _roleProvider;
    private readonly ILogger<RoleService> _logger;

    public RoleService(IRoleProvider roleProvider, ILogger<RoleService> logger)
    {
        _roleProvider = roleProvider;
        _logger = logger;
    }

    public async Task<IEnumerable<RoleDto>> GetAllRolesAsync()
    {
        try
        {
            return await _roleProvider.GetAllRolesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all roles");
            throw;
        }
    }

    public async Task<RoleDto?> GetRoleByIdAsync(int roleId)
    {
        try
        {
            return await _roleProvider.GetRoleByIdAsync(roleId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting role by ID: {RoleId}", roleId);
            throw;
        }
    }

    public async Task<RoleDto> CreateRoleAsync(CreateRoleRequest request, int currentUserId)
    {
        try
        {
            // Validate that current user is admin
            if (!await ValidateUserHasRoleAsync(currentUserId, "Admin"))
            {
                throw new UnauthorizedAccessException("Only administrators can create roles");
            }

            // Validate role name uniqueness
            var existingRoles = await _roleProvider.GetAllRolesAsync();
            if (existingRoles.Any(r => r.RoleName.Equals(request.RoleName, StringComparison.OrdinalIgnoreCase)))
            {
                throw new ArgumentException($"Role with name '{request.RoleName}' already exists");
            }

            return await _roleProvider.CreateRoleAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating role: {RoleName}", request.RoleName);
            throw;
        }
    }

    public async Task<RoleDto> UpdateRoleAsync(int roleId, UpdateRoleRequest request, int currentUserId)
    {
        try
        {
            // Validate that current user is admin
            if (!await ValidateUserHasRoleAsync(currentUserId, "Admin"))
            {
                throw new UnauthorizedAccessException("Only administrators can update roles");
            }

            // Check if role exists
            var existingRole = await _roleProvider.GetRoleByIdAsync(roleId);
            if (existingRole == null)
            {
                throw new ArgumentException($"Role with ID {roleId} not found");
            }

            // Validate role name uniqueness (excluding current role)
            var existingRoles = await _roleProvider.GetAllRolesAsync();
            if (existingRoles.Any(r => r.RoleId != roleId && r.RoleName.Equals(request.RoleName, StringComparison.OrdinalIgnoreCase)))
            {
                throw new ArgumentException($"Role with name '{request.RoleName}' already exists");
            }

            return await _roleProvider.UpdateRoleAsync(roleId, request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating role: {RoleId}", roleId);
            throw;
        }
    }

    public async Task<bool> DeleteRoleAsync(int roleId, int currentUserId)
    {
        try
        {
            // Validate that current user is admin
            if (!await ValidateUserHasRoleAsync(currentUserId, "Admin"))
            {
                throw new UnauthorizedAccessException("Only administrators can delete roles");
            }

            // Check if role exists
            var existingRole = await _roleProvider.GetRoleByIdAsync(roleId);
            if (existingRole == null)
            {
                return false;
            }

            // Check if role is in use
            var usersWithRole = await _roleProvider.GetUsersByRoleAsync(roleId);
            if (usersWithRole.Any())
            {
                throw new InvalidOperationException($"Cannot delete role '{existingRole.RoleName}' as it is assigned to {usersWithRole.Count()} users");
            }

            return await _roleProvider.DeleteRoleAsync(roleId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting role: {RoleId}", roleId);
            throw;
        }
    }

    public async Task<IEnumerable<UserRoleDto>> GetUserRolesAsync(int userId)
    {
        try
        {
            return await _roleProvider.GetUserRolesAsync(userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user roles for user: {UserId}", userId);
            throw;
        }
    }

    public async Task<UserRoleDto> AssignUserRoleAsync(AssignUserRoleRequest request, int currentUserId)
    {
        try
        {
            // Validate that current user can assign this role
            if (!await ValidateUserCanAssignRoleAsync(currentUserId, request.UserId, request.RoleId))
            {
                throw new UnauthorizedAccessException("You don't have permission to assign this role");
            }

            // Validate role exists
            var role = await _roleProvider.GetRoleByIdAsync(request.RoleId);
            if (role == null)
            {
                throw new ArgumentException($"Role with ID {request.RoleId} not found");
            }

            return await _roleProvider.AssignUserRoleAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning user role: UserId={UserId}, RoleId={RoleId}", 
                request.UserId, request.RoleId);
            throw;
        }
    }

    public async Task<bool> RemoveUserRoleAsync(int userId, int roleId, int currentUserId)
    {
        try
        {
            // Validate that current user can remove this role
            if (!await ValidateUserCanAssignRoleAsync(currentUserId, userId, roleId))
            {
                throw new UnauthorizedAccessException("You don't have permission to remove this role");
            }

            return await _roleProvider.RemoveUserRoleAsync(userId, roleId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing user role: UserId={UserId}, RoleId={RoleId}", userId, roleId);
            throw;
        }
    }

    public async Task<IEnumerable<UserDto>> GetUsersByRoleAsync(int roleId)
    {
        try
        {
            return await _roleProvider.GetUsersByRoleAsync(roleId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting users by role: {RoleId}", roleId);
            throw;
        }
    }

    public async Task<bool> ValidateUserHasRoleAsync(int userId, string roleName)
    {
        try
        {
            var userRoles = await _roleProvider.GetUserRolesAsync(userId);
            return userRoles.Any(ur => ur.RoleName.Equals(roleName, StringComparison.OrdinalIgnoreCase));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating user role: UserId={UserId}, RoleName={RoleName}", userId, roleName);
            return false;
        }
    }

    public async Task<bool> ValidateUserCanAssignRoleAsync(int currentUserId, int targetUserId, int roleId)
    {
        try
        {
            // Only admins can assign roles
            if (!await ValidateUserHasRoleAsync(currentUserId, "Admin"))
            {
                return false;
            }

            // Users cannot assign roles to themselves (business rule)
            if (currentUserId == targetUserId)
            {
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating role assignment permission: CurrentUserId={CurrentUserId}, TargetUserId={TargetUserId}, RoleId={RoleId}", 
                currentUserId, targetUserId, roleId);
            return false;
        }
    }
}

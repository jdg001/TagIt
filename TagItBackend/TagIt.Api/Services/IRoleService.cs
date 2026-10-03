using TagIt.Api.Models;
using TagIt.Api.Models.Users;

namespace TagIt.Api.Services;

public interface IRoleService
{
    Task<IEnumerable<RoleDto>> GetAllRolesAsync();
    Task<RoleDto?> GetRoleByIdAsync(int roleId);
    Task<RoleDto> CreateRoleAsync(CreateRoleRequest request, int currentUserId);
    Task<RoleDto> UpdateRoleAsync(int roleId, UpdateRoleRequest request, int currentUserId);
    Task<bool> DeleteRoleAsync(int roleId, int currentUserId);
    Task<IEnumerable<UserRoleDto>> GetUserRolesAsync(int userId);
    Task<UserRoleDto> AssignUserRoleAsync(AssignUserRoleRequest request, int currentUserId);
    Task<bool> RemoveUserRoleAsync(int userId, int roleId, int currentUserId);
    Task<IEnumerable<UserDto>> GetUsersByRoleAsync(int roleId);
    Task<bool> ValidateUserHasRoleAsync(int userId, string roleName);
    Task<bool> ValidateUserCanAssignRoleAsync(int currentUserId, int targetUserId, int roleId);
}

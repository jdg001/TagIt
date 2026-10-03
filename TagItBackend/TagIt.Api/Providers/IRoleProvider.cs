using TagIt.Api.Models;
using TagIt.Api.Models.Users;

namespace TagIt.Api.Providers;

public interface IRoleProvider
{
    Task<IEnumerable<RoleDto>> GetAllRolesAsync();
    Task<RoleDto?> GetRoleByIdAsync(int roleId);
    Task<RoleDto> CreateRoleAsync(CreateRoleRequest request);
    Task<RoleDto> UpdateRoleAsync(int roleId, UpdateRoleRequest request);
    Task<bool> DeleteRoleAsync(int roleId);
    Task<IEnumerable<UserRoleDto>> GetUserRolesAsync(int userId);
    Task<UserRoleDto> AssignUserRoleAsync(AssignUserRoleRequest request);
    Task<bool> RemoveUserRoleAsync(int userId, int roleId);
    Task<IEnumerable<UserDto>> GetUsersByRoleAsync(int roleId);
}

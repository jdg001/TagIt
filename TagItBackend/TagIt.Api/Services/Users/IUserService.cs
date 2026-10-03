using TagIt.Api.Models.Users;

namespace TagIt.Api.Services.Users;

public interface IUserService
{
    Task<PagedResult<UserDto>> GetAllAsync(Guid? tenantId, string? search, bool? isActive, int skip, int take, CancellationToken ct);
    Task<UserDto?> GetByIdAsync(int id, CancellationToken ct);
    Task<UserDto?> GetByEmailAsync(string email, CancellationToken ct);
    Task<(UserDto? result, string? error)> CreateAsync(UserCreateDto dto, CancellationToken ct);
    Task<(UserDto? result, string? error)> UpdateAsync(int id, UserUpdateDto dto, CancellationToken ct);
    Task<bool> DeleteAsync(int id, CancellationToken ct);
    Task<bool> ActivateAsync(int id, CancellationToken ct);
    Task<bool> DeactivateAsync(int id, CancellationToken ct);
    Task<PagedResult<UserWithRolesDto>> SearchUsersAsync(UserSearchFilters filters, CancellationToken ct);
    Task<bool> AssignMultipleRolesAsync(int userId, AssignMultipleRolesRequest request, CancellationToken ct);
    Task<bool> RemoveUserRoleAsync(int userId, int roleId, CancellationToken ct);
    Task<UserDto?> ValidateAdminCredentialsAsync(string email, string password, CancellationToken ct);
}

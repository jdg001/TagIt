using TagIt.Api.Models.Users;
using TagIt.Api.Models;

namespace TagIt.Api.Providers.Users;

public interface IUserProvider
{
    IQueryable<User> Query();
    Task<User?> GetByIdAsync(int id, CancellationToken ct);
    Task<User?> GetByEmailAsync(string email, CancellationToken ct);
    Task<bool> TenantExistsAsync(Guid tenantId, CancellationToken ct);
    Task<bool> EmailExistsInTenantAsync(Guid tenantId, string email, int? excludeUserId, CancellationToken ct);

    Task AddAsync(User entity, CancellationToken ct);
    Task RemoveAsync(User entity, CancellationToken ct);
    Task RemoveAllUserRolesAsync(int userId, CancellationToken ct);
    Task<bool> CheckUserConstraintsAsync(int userId, CancellationToken ct);
    Task<int> SaveChangesAsync(CancellationToken ct);

    // Role management methods
    Task<List<UserRoleDto>> GetUserRolesAsync(int userId, CancellationToken ct);
    Task AssignUserRoleAsync(int userId, int roleId, DateTime? expiresAt, CancellationToken ct);
    Task<bool> RemoveUserRoleAsync(int userId, int roleId, CancellationToken ct);
}

using Microsoft.EntityFrameworkCore;
using TagIt.Api.Models.Users;
using TagIt.Api.Providers.Users;

namespace TagIt.Api.Services.Users;

public sealed class UserService(IUserProvider provider) : IUserService
{
    private readonly IUserProvider _provider = provider;

    public async Task<PagedResult<UserDto>> GetAllAsync(Guid? tenantId, string? search, bool? isActive, int skip, int take, CancellationToken ct)
    {
        take = Math.Clamp(take, 1, 200);
        var q = _provider.Query().AsNoTracking();

        if (tenantId.HasValue)
            q = q.Where(u => u.TenantId == tenantId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLowerInvariant();
            q = q.Where(u => u.Email.ToLower().Contains(s));
        }

        if (isActive.HasValue)
            q = q.Where(u => u.IsActive == isActive.Value);

        var total = await q.LongCountAsync(ct);
        var items = await q.OrderBy(u => u.Email)
                           .Skip(skip)
                           .Take(take)
                           .Select(u => u.ToDto())
                           .ToListAsync(ct);

        return new PagedResult<UserDto> { Items = items, Skip = skip, Take = take, Total = total };
    }

    public async Task<UserDto?> GetByIdAsync(int id, CancellationToken ct)
    {
        var entity = await _provider.Query().AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserId == id, ct);
        return entity?.ToDto();
    }

    public async Task<UserDto?> GetByEmailAsync(string email, CancellationToken ct)
    {
        var normalized = NormalizeEmail(email);
        var entity = await _provider.Query().AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == normalized, ct);
        return entity?.ToDto();
    }

    public async Task<(UserDto? result, string? error)> CreateAsync(UserCreateDto dto, CancellationToken ct)
    {
        // Tenant must exist
        if (!await _provider.TenantExistsAsync(dto.TenantId, ct))
            return (null, "InvalidTenant");

        var email = NormalizeEmail(dto.Email);

        // Unique per tenant
        if (await _provider.EmailExistsInTenantAsync(dto.TenantId, email, null, ct))
            return (null, "DuplicateEmail");

        var entity = new User
        {
            TenantId = dto.TenantId,
            Email = email,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        await _provider.AddAsync(entity, ct);
        await _provider.SaveChangesAsync(ct);

        // Assign roles if provided
        if (dto.RoleIds?.Count > 0)
        {
            foreach (var roleId in dto.RoleIds)
            {
                await _provider.AssignUserRoleAsync(entity.UserId, roleId, null, ct);
            }
        }

        return (entity.ToDto(), null);
    }

    public async Task<(UserDto? result, string? error)> UpdateAsync(int id, UserUpdateDto dto, CancellationToken ct)
    {
        var entity = await _provider.GetByIdAsync(id, ct);
        if (entity is null) return (null, "NotFound");

        var email = NormalizeEmail(dto.Email);

        if (await _provider.EmailExistsInTenantAsync(entity.TenantId, email, excludeUserId: id, ct))
            return (null, "DuplicateEmail");

        entity.Email = email;
        entity.IsActive = dto.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;

        await _provider.SaveChangesAsync(ct);

        // Update roles if provided
        if (dto.RoleIds?.Count >= 0) // Allow empty list to remove all roles
        {
            // Get current roles
            var existingRoles = await _provider.GetUserRolesAsync(id, ct);
            var existingRoleIds = existingRoles.Select(r => r.RoleId).ToHashSet();
            var newRoleIds = dto.RoleIds.ToHashSet();

            // Remove roles that are not in the new list
            var rolesToRemove = existingRoleIds.Except(newRoleIds);
            foreach (var roleId in rolesToRemove)
            {
                await _provider.RemoveUserRoleAsync(id, roleId, ct);
            }

            // Add roles that are not already assigned
            var rolesToAdd = newRoleIds.Except(existingRoleIds);
            foreach (var roleId in rolesToAdd)
            {
                await _provider.AssignUserRoleAsync(id, roleId, null, ct);
            }
        }

        return (entity.ToDto(), null);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct)
    {
        var entity = await _provider.GetByIdAsync(id, ct);
        if (entity is null) return false;

        // Check for foreign key constraints before deletion
        var hasConstraints = await _provider.CheckUserConstraintsAsync(id, ct);
        if (hasConstraints)
        {
            throw new InvalidOperationException("Cannot delete user. This user is referenced by other records in the system (e.g., as a reviewer for templates). Please reassign or complete these references before deleting the user.");
        }

        // First, remove all user roles
        await _provider.RemoveAllUserRolesAsync(id, ct);
        
        // Then remove the user
        await _provider.RemoveAsync(entity, ct);
        await _provider.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> ActivateAsync(int id, CancellationToken ct)
    {
        var entity = await _provider.GetByIdAsync(id, ct);
        if (entity is null) return false;

        if (!entity.IsActive)
        {
            entity.IsActive = true;
            entity.UpdatedAt = DateTime.UtcNow;
            await _provider.SaveChangesAsync(ct);
        }
        return true;
    }

    public async Task<bool> DeactivateAsync(int id, CancellationToken ct)
    {
        var entity = await _provider.GetByIdAsync(id, ct);
        if (entity is null) return false;

        if (entity.IsActive)
        {
            entity.IsActive = false;
            entity.UpdatedAt = DateTime.UtcNow;
            await _provider.SaveChangesAsync(ct);
        }
        return true;
    }

    public async Task<PagedResult<UserWithRolesDto>> SearchUsersAsync(UserSearchFilters filters, CancellationToken ct)
    {
        var take = Math.Clamp(filters.Take, 1, 200);
        var q = _provider.Query().AsNoTracking();

        // Filter by tenant
        if (filters.TenantId.HasValue)
            q = q.Where(u => u.TenantId == filters.TenantId.Value);

        // Search by email
        if (!string.IsNullOrWhiteSpace(filters.Search))
        {
            var searchTerm = filters.Search.Trim().ToLowerInvariant();
            q = q.Where(u => u.Email.ToLower().Contains(searchTerm));
        }

        // Filter by active status
        if (filters.IsActive.HasValue)
            q = q.Where(u => u.IsActive == filters.IsActive.Value);

        // Date range filters
        if (filters.CreatedAfter.HasValue)
            q = q.Where(u => u.CreatedAt >= filters.CreatedAfter.Value);
        if (filters.CreatedBefore.HasValue)
            q = q.Where(u => u.CreatedAt <= filters.CreatedBefore.Value);

        var total = await q.LongCountAsync(ct);
        var items = await q.OrderBy(u => u.Email)
                           .Skip(filters.Skip)
                           .Take(take)
                           .Select(u => new UserWithRolesDto
                           {
                               UserId = u.UserId,
                               Email = u.Email,
                               TenantId = u.TenantId,
                               IsActive = u.IsActive,
                               CreatedAt = u.CreatedAt,
                               UpdatedAt = u.UpdatedAt,
                               Roles = u.UserRoles.Select(ur => ur.Role.RoleName)
                                                  .ToList()
                           })
                           .ToListAsync(ct);

        // Apply role filtering after projection (since we can't easily filter roles in the query)
        if (filters.Roles?.Count > 0)
        {
            items = items.Where(u => u.Roles.Any(r => filters.Roles!.Contains(r))).ToList();
        }

        return new PagedResult<UserWithRolesDto> { Items = items, Skip = filters.Skip, Take = take, Total = total };
    }

    public async Task<bool> AssignMultipleRolesAsync(int userId, AssignMultipleRolesRequest request, CancellationToken ct)
    {
        var user = await _provider.GetByIdAsync(userId, ct);
        if (user is null) return false;

        // Get current roles
        var existingRoles = await _provider.GetUserRolesAsync(userId, ct);
        var existingRoleIds = existingRoles.Select(r => r.RoleId).ToHashSet();
        var newRoleIds = request.RoleIds.ToHashSet();

        // Remove roles that are not in the new list
        var rolesToRemove = existingRoleIds.Except(newRoleIds);
        foreach (var roleId in rolesToRemove)
        {
            await _provider.RemoveUserRoleAsync(userId, roleId, ct);
        }

        // Add roles that are not already assigned
        var rolesToAdd = newRoleIds.Except(existingRoleIds);
        foreach (var roleId in rolesToAdd)
        {
            await _provider.AssignUserRoleAsync(userId, roleId, request.ExpiresAt, ct);
        }

        return true;
    }

    public async Task<bool> RemoveUserRoleAsync(int userId, int roleId, CancellationToken ct)
    {
        return await _provider.RemoveUserRoleAsync(userId, roleId, ct);

    }

    public async Task<UserDto?> ValidateAdminCredentialsAsync(string email, string password, CancellationToken ct)
    {
        var normalized = NormalizeEmail(email);
        var entity = await _provider.Query().AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == normalized && u.PasswordHash != null, ct);
        
        if (entity == null)
            return null;

        // For now, we'll do a simple string comparison
        // In production, you should use proper password hashing like BCrypt
        if (entity.PasswordHash != password)
            return null;

        return entity.ToDto();
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}

// mapping helper
internal static class UserMapping
{
    public static UserDto ToDto(this User u) => new()
    {
        UserId = u.UserId,
        TenantId = u.TenantId,
        Email = u.Email,
        IsActive = u.IsActive,
        CreatedAt = DateTime.SpecifyKind(u.CreatedAt, DateTimeKind.Utc),
        UpdatedAt = u.UpdatedAt.HasValue ? DateTime.SpecifyKind(u.UpdatedAt.Value, DateTimeKind.Utc) : null
    };
}

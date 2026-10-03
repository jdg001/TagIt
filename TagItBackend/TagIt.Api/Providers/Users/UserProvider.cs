using Microsoft.EntityFrameworkCore;
using TagIt.Api.Data;
using TagIt.Api.Models.Users;
using TagIt.Api.Models;

namespace TagIt.Api.Providers.Users;

public sealed class UserProvider(AppDb db) : IUserProvider
{
    private readonly AppDb _db = db;

    public IQueryable<User> Query() => _db.Users;

    public Task<User?> GetByIdAsync(int id, CancellationToken ct) =>
        _db.Users.FirstOrDefaultAsync(u => u.UserId == id, ct);

    public Task<User?> GetByEmailAsync(string email, CancellationToken ct) =>
        _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

    public Task<bool> TenantExistsAsync(Guid tenantId, CancellationToken ct) =>
        _db.Tenants.AnyAsync(t => t.TenantId == tenantId, ct);

    public Task<bool> EmailExistsInTenantAsync(Guid tenantId, string email, int? excludeUserId, CancellationToken ct) =>
        _db.Users.AnyAsync(u => u.TenantId == tenantId && u.Email == email && (excludeUserId == null || u.UserId != excludeUserId), ct);

    public Task AddAsync(User entity, CancellationToken ct)
    {
        _db.Users.Add(entity);
        return Task.CompletedTask;
    }

    public Task RemoveAsync(User entity, CancellationToken ct)
    {
        _db.Users.Remove(entity);
        return Task.CompletedTask;
    }

    public async Task RemoveAllUserRolesAsync(int userId, CancellationToken ct)
    {
        var userRoles = await _db.UserRole
            .Where(ur => ur.UserId == userId)
            .ToListAsync(ct);
        
        _db.UserRole.RemoveRange(userRoles);
    }

    public async Task<bool> CheckUserConstraintsAsync(int userId, CancellationToken ct)
    {
        // Check if user is referenced as a reviewer in DesignState
        var isReviewer = await _db.DesignState
            .AnyAsync(ds => ds.ReviewerId == userId, ct);
        
        if (isReviewer) return true;

        // Check if user is referenced as a designer in DesignState
        var isDesigner = await _db.DesignState
            .AnyAsync(ds => ds.DesignerId == userId, ct);
        
        if (isDesigner) return true;

        // Check if user is referenced as StateChangedBy in DesignState
        var isStateChanger = await _db.DesignState
            .AnyAsync(ds => ds.StateChangedBy == userId, ct);
        
        if (isStateChanger) return true;

        // Add more constraint checks here as needed
        // For example, if there are other tables that reference UserId

        return false;
    }

    public Task<int> SaveChangesAsync(CancellationToken ct) => _db.SaveChangesAsync(ct);

    public async Task<List<UserRoleDto>> GetUserRolesAsync(int userId, CancellationToken ct)
    {
        return await _db.UserRole
            .Where(ur => ur.UserId == userId)
            .Select(ur => new UserRoleDto
            {
                UserId = ur.UserId,
                RoleId = ur.RoleId,
                RoleName = ur.Role.RoleName
            })
            .ToListAsync(ct);
    }

    public async Task AssignUserRoleAsync(int userId, int roleId, DateTime? expiresAt, CancellationToken ct)
    {
        var userRole = new UserRole
        {
            UserId = userId,
            RoleId = roleId,
            ExpiresAt = expiresAt
        };
        _db.UserRole.Add(userRole);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<bool> RemoveUserRoleAsync(int userId, int roleId, CancellationToken ct)
    {
        var userRole = await _db.UserRole
            .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoleId == roleId, ct);
        
        if (userRole == null) return false;
        
        _db.UserRole.Remove(userRole);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}

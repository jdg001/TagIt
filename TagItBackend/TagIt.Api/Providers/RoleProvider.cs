using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Data;
using TagIt.Api.Data;
using TagIt.Api.Models;
using TagIt.Api.Models.Users;

namespace TagIt.Api.Providers;

public class RoleProvider : IRoleProvider
{
    private readonly AppDb _context;
    private readonly ILogger<RoleProvider> _logger;

    public RoleProvider(AppDb context, ILogger<RoleProvider> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<IEnumerable<RoleDto>> GetAllRolesAsync()
    {
        try
        {
            var roles = await _context.Database.SqlQueryRaw<RoleDto>(
                "EXEC sp_GetAllRoles").ToListAsync();
            return roles;
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
            var role = await _context.RolesLookUp
                .Where(r => r.RoleId == roleId && r.IsActive)
                .Select(r => new RoleDto
                {
                    RoleId = r.RoleId,
                    RoleName = r.RoleName,
                    RoleDescription = r.RoleDescription,
                    IsActive = r.IsActive,
                    CreatedAt = r.CreatedAt,
                    UpdatedAt = r.UpdatedAt
                })
                .FirstOrDefaultAsync();
            return role;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting role by ID: {RoleId}", roleId);
            throw;
        }
    }

    public async Task<RoleDto> CreateRoleAsync(CreateRoleRequest request)
    {
        try
        {
            var role = new RolesLookUp
            {
                RoleName = request.RoleName,
                RoleDescription = request.RoleDescription,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.RolesLookUp.Add(role);
            await _context.SaveChangesAsync();

            return new RoleDto
            {
                RoleId = role.RoleId,
                RoleName = role.RoleName,
                RoleDescription = role.RoleDescription,
                IsActive = role.IsActive,
                CreatedAt = role.CreatedAt,
                UpdatedAt = role.UpdatedAt
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating role: {RoleName}", request.RoleName);
            throw;
        }
    }

    public async Task<RoleDto> UpdateRoleAsync(int roleId, UpdateRoleRequest request)
    {
        try
        {
            var role = await _context.RolesLookUp.FindAsync(roleId);
            if (role == null)
                throw new ArgumentException($"Role with ID {roleId} not found");

            role.RoleName = request.RoleName;
            role.RoleDescription = request.RoleDescription;
            role.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return new RoleDto
            {
                RoleId = role.RoleId,
                RoleName = role.RoleName,
                RoleDescription = role.RoleDescription,
                IsActive = role.IsActive,
                CreatedAt = role.CreatedAt,
                UpdatedAt = role.UpdatedAt
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating role: {RoleId}", roleId);
            throw;
        }
    }

    public async Task<bool> DeleteRoleAsync(int roleId)
    {
        try
        {
            var role = await _context.RolesLookUp.FindAsync(roleId);
            if (role == null)
                return false;

            role.IsActive = false;
            role.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
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
            var userRoles = await _context.Database.SqlQueryRaw<UserRoleDto>(
                "EXEC sp_GetUserRoles @UserId",
                new SqlParameter("@UserId", userId)).ToListAsync();
            return userRoles;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user roles for user: {UserId}", userId);
            throw;
        }
    }

    public async Task<UserRoleDto> AssignUserRoleAsync(AssignUserRoleRequest request)
    {
        try
        {
            var result = await _context.Database.SqlQueryRaw<SpResult>(
                "EXEC sp_AssignUserRole @UserId, @RoleId, @AssignedBy, @ExpiresAt",
                new SqlParameter("@UserId", request.UserId),
                new SqlParameter("@RoleId", request.RoleId),
                new SqlParameter("@AssignedBy", request.AssignedBy),
                new SqlParameter("@ExpiresAt", request.ExpiresAt ?? (object)DBNull.Value)
            ).FirstOrDefaultAsync();

            if (result?.Result == "ERROR")
                throw new InvalidOperationException(result.Message);

            // Get the assigned role details
            var userRoles = await GetUserRolesAsync(request.UserId);
            return userRoles.FirstOrDefault(ur => ur.RoleId == request.RoleId) 
                ?? throw new InvalidOperationException("Failed to retrieve assigned role");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning user role: UserId={UserId}, RoleId={RoleId}", 
                request.UserId, request.RoleId);
            throw;
        }
    }

    public async Task<bool> RemoveUserRoleAsync(int userId, int roleId)
    {
        try
        {
            var userRole = await _context.UserRole
                .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoleId == roleId);

            if (userRole == null)
                return false;

            _context.UserRole.Remove(userRole);
            await _context.SaveChangesAsync();
            return true;
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
            var users = await _context.UserRole
                .Where(ur => ur.RoleId == roleId)
                .Include(ur => ur.User)
                .Select(ur => new UserDto
                {
                    UserId = ur.User.UserId,
                    Email = ur.User.Email,
                    //FirstName = ur.User.FirstName,
                    //LastName = ur.User.LastName,
                    //IsActive = ur.User.IsActive,
                    //CreatedAt = ur.User.CreatedAt,
                    //UpdatedAt = ur.User.UpdatedAt
                })
                .ToListAsync();
            return users;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting users by role: {RoleId}", roleId);
            throw;
        }
    }
}

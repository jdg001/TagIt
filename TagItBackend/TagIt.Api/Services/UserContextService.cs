using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace TagIt.Api.Services;

public class UserContextService : IUserContextService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public UserContextService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public int GetCurrentUserId()
    {
        if (!IsAuthenticated())
        {
            throw new UnauthorizedAccessException("User is not authenticated");
        }

        var userIdClaim = _httpContextAccessor.HttpContext?.User?.FindFirst("user_id")?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            throw new UnauthorizedAccessException("Invalid user ID in JWT token");
        }
        
        return userId;
    }

    public string GetCurrentUserEmail()
    {
        if (!IsAuthenticated())
        {
            throw new UnauthorizedAccessException("User is not authenticated");
        }

        return _httpContextAccessor.HttpContext?.User?.FindFirst("email")?.Value 
               ?? throw new UnauthorizedAccessException("Email not found in JWT token");
    }

    public string GetCurrentUserRole()
    {
        if (!IsAuthenticated())
        {
            throw new UnauthorizedAccessException("User is not authenticated");
        }

        return _httpContextAccessor.HttpContext?.User?.FindFirst("role")?.Value 
               ?? throw new UnauthorizedAccessException("Role not found in JWT token");
    }

    public Guid GetCurrentTenantId()
    {
        if (!IsAuthenticated())
        {
            throw new UnauthorizedAccessException("User is not authenticated");
        }

        var tenantIdClaim = _httpContextAccessor.HttpContext?.User?.FindFirst("tenant_id")?.Value;
        if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out Guid tenantId))
        {
            throw new UnauthorizedAccessException("Invalid tenant ID in JWT token");
        }
        
        return tenantId;
    }

    public bool IsAuthenticated()
    {
        return _httpContextAccessor.HttpContext?.User?.Identity?.IsAuthenticated ?? false;
    }
}

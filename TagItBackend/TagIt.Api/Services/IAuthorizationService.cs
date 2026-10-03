using TagIt.Api.Models;

namespace TagIt.Api.Services;

public interface IAuthorizationService
{
    /// <summary>
    /// Generate Google OAuth login URL for the given email
    /// </summary>
    /// <param name="request">Login request containing email</param>
    /// <param name="configuration">Application configuration</param>
    /// <returns>Google OAuth login response with authorization URL</returns>
    Task<GoogleLoginResponse> GenerateGoogleLoginUrlAsync(GoogleLoginRequest request, IConfiguration configuration);

    /// <summary>
    /// Process Google OAuth callback and generate JWT token
    /// </summary>
    /// <param name="code">Authorization code from Google</param>
    /// <param name="state">State parameter containing email and tenant domain</param>
    /// <param name="configuration">Application configuration</param>
    /// <returns>JWT token string</returns>
    Task<string> ProcessGoogleCallbackAsync(string code, string state, IConfiguration configuration);

    /// <summary>
    /// Create application JWT token for local admin authentication
    /// </summary>
    /// <param name="email">User email</param>
    /// <param name="name">User name</param>
    /// <param name="tenantDomain">Tenant domain</param>
    /// <param name="userId">User ID</param>
    /// <param name="tenantId">Tenant ID</param>
    /// <param name="roles">User roles</param>
    /// <param name="configuration">Application configuration</param>
    /// <returns>JWT token string</returns>
    Task<string> CreateAppJwtAsync(string email, string name, string tenantDomain, int userId, Guid tenantId, List<string> roles, IConfiguration configuration);
}

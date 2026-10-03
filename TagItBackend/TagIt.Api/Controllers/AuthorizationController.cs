using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TagIt.Api.Models;
using TagIt.Api.Services;

namespace TagIt.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthorizationController : ControllerBase
{
    private readonly TagIt.Api.Services.IAuthorizationService _authorizationService;
    private readonly ILogger<AuthorizationController> _logger;

    public AuthorizationController(TagIt.Api.Services.IAuthorizationService authorizationService, ILogger<AuthorizationController> logger)
    {
        _authorizationService = authorizationService;
        _logger = logger;
    }

    /// <summary>
    /// Initiate Google OAuth login process or handle local admin authentication
    /// </summary>
    /// <param name="request">Login request containing user email and optional password</param>
    /// <returns>Google OAuth authorization URL or JWT token for admin</returns>
    [HttpPost("google/login")]
    [AllowAnonymous]
    public async Task<ActionResult<GoogleLoginResponse>> GoogleLogin([FromBody] GoogleLoginRequest request)
    {
        try
        {
            _logger.LogInformation("Login request received for email: {Email}", request.Email);

            // Check if this is a local admin authentication request
            if (request.Email.ToLowerInvariant() == "admin@tagit.net" && !string.IsNullOrWhiteSpace(request.Password))
            {
                _logger.LogInformation("Processing local admin authentication for: {Email}", request.Email);

                // Validate admin credentials
                var userService = HttpContext.RequestServices.GetRequiredService<TagIt.Api.Services.Users.IUserService>();
                var roleService = HttpContext.RequestServices.GetRequiredService<TagIt.Api.Services.IRoleService>();
                var configuration = HttpContext.RequestServices.GetRequiredService<IConfiguration>();

                var user = await userService.ValidateAdminCredentialsAsync(request.Email, request.Password, CancellationToken.None);
                if (user == null)
                {
                    _logger.LogWarning("Invalid admin credentials for email: {Email}", request.Email);
                    return Unauthorized("Invalid email or password");
                }

                // Get user roles
                List<string> roleList = ["Admin"]; // Default role

                // Create JWT token for admin
                var jwtToken = await _authorizationService.CreateAppJwtAsync(
                    request.Email, 
                    "TagIt Admin", 
                    "tagit.net", 
                    user.UserId, 
                    user.TenantId, 
                    roleList, 
                    configuration);

                _logger.LogInformation("Admin authentication successful for: {Email}", request.Email);

                // Return JWT token in the response (frontend will handle this)
                var response = new GoogleLoginResponse
                {
                    AuthUrl = $"http://localhost:4200/auth/callback?token={Uri.EscapeDataString(jwtToken)}"
                };

                return Ok(response);
            }
            else
            {
                // Continue with regular Google OAuth flow
                _logger.LogInformation("Processing Google OAuth flow for email: {Email}", request.Email);
                var response = await _authorizationService.GenerateGoogleLoginUrlAsync(request, HttpContext.RequestServices.GetRequiredService<IConfiguration>());
                
                _logger.LogInformation("Google login URL generated successfully for email: {Email}", request.Email);
                return Ok(response);
            }
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning("Invalid request for login: {Message}", ex.Message);
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogError("Configuration error for login: {Message}", ex.Message);
            return Problem(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during login for email: {Email}", request.Email);
            return Problem("Internal server error occurred during login process");
        }
    }

    /// <summary>
    /// Handle Google OAuth callback and redirect to frontend with JWT token
    /// </summary>
    /// <param name="code">Authorization code from Google</param>
    /// <param name="state">State parameter containing email and tenant domain</param>
    /// <returns>Redirect to frontend with JWT token</returns>
    [HttpGet("google/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> GoogleCallback([FromQuery] string code, [FromQuery] string state)
    {
        try
        {
            _logger.LogInformation("Google OAuth callback received with code: {Code}", code?.Substring(0, Math.Min(10, code?.Length ?? 0)) + "...");

            var jwtToken = await _authorizationService.ProcessGoogleCallbackAsync(code, state, HttpContext.RequestServices.GetRequiredService<IConfiguration>());
            
            // Redirect to Angular app with JWT token as query parameter
            var redirectUrl = $"http://localhost:4200/auth/callback?token={Uri.EscapeDataString(jwtToken)}";
            
            _logger.LogInformation("Redirecting to frontend with JWT token");
            return Redirect(redirectUrl);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning("Invalid callback parameters: {Message}", ex.Message);
            return BadRequest(ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning("User not registered: {Message}", ex.Message);
            // Redirect to login page with error message
            var redirectUrl = $"http://localhost:4200/login?error={Uri.EscapeDataString(ex.Message)}";
            return Redirect(redirectUrl);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogError("OAuth processing error: {Message}", ex.Message);
            return Problem(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during Google OAuth callback processing. Exception type: {ExceptionType}, Message: {Message}", ex.GetType().Name, ex.Message);
            return Problem("Internal server error occurred during authentication process");
        }
    }

    /// <summary>
    /// Validate JWT token (for testing/debugging purposes)
    /// </summary>
    /// <param name="token">JWT token to validate</param>
    /// <returns>Token validation result</returns>
    [HttpPost("validate")]
    public IActionResult ValidateToken([FromBody] string token)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                return BadRequest("Token is required");
            }

            var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
            var jsonToken = handler.ReadJwtToken(token);

            var result = new
            {
                Valid = true,
                Claims = jsonToken.Claims.ToDictionary(c => c.Type, c => c.Value),
                Expires = jsonToken.ValidTo
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating JWT token");
            return BadRequest("Invalid token");
        }
    }
}

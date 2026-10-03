using Microsoft.IdentityModel.Tokens;
using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using TagIt.Api.Models;
using TagIt.Api.Models.Users;
using TagIt.Api.Services.Users;

namespace TagIt.Api.Services;

public class AuthorizationService : IAuthorizationService
{
    private readonly ILogger<AuthorizationService> _logger;
    private readonly IUserService _userService;
    private readonly IRoleService _roleService;

    public AuthorizationService(ILogger<AuthorizationService> logger, IUserService userService, IRoleService roleService)
    {
        _logger = logger;
        _userService = userService;
        _roleService = roleService;
    }

    public async Task<GoogleLoginResponse> GenerateGoogleLoginUrlAsync(GoogleLoginRequest request, IConfiguration configuration)
    {
        try
        {
            _logger.LogInformation("Generating Google OAuth URL for email: {Email}", request.Email);

            // Validate email
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                throw new ArgumentException("Email is required");
            }

            // Parse email and extract domain
            var emailParts = request.Email.Split('@');
            if (emailParts.Length != 2)
            {
                throw new ArgumentException("Invalid email format");
            }

            var tenantDomain = emailParts[1];

            // Get Google OAuth configuration
            var clientId = configuration["Authentication:Google:ClientId"];
            var clientSecret = configuration["Authentication:Google:ClientSecret"];

            if (string.IsNullOrWhiteSpace(clientId))
            {
                throw new InvalidOperationException("Google OAuth configuration is missing");
            }

            // Create state parameter with email and tenant domain
            var stateData = new
            {
                email = request.Email,
                tenantDomain = tenantDomain
            };
            var stateJson = JsonSerializer.Serialize(stateData);
            var state = Convert.ToBase64String(Encoding.UTF8.GetBytes(stateJson))
                .Replace('+', '-')
                .Replace('/', '_')
                .Replace("=", "");

            // Build Google OAuth authorization URL
            var authUrl = new StringBuilder("https://accounts.google.com/o/oauth2/v2/auth?");
            authUrl.Append($"client_id={Uri.EscapeDataString(clientId)}");
            authUrl.Append($"&redirect_uri={Uri.EscapeDataString("http://localhost:5222/api/auth/google/callback")}");
            authUrl.Append("&response_type=code");
            authUrl.Append("&scope=openid email profile");
            authUrl.Append("&access_type=offline");
            authUrl.Append("&prompt=consent");
            authUrl.Append($"&state={Uri.EscapeDataString(state)}");

            var response = new GoogleLoginResponse
            {
                AuthUrl = authUrl.ToString()
            };

            _logger.LogInformation("Successfully generated Google OAuth URL for email: {Email}", request.Email);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating Google OAuth URL for email: {Email}", request.Email);
            throw;
        }
    }

    public async Task<string> ProcessGoogleCallbackAsync(string code, string state, IConfiguration configuration)
    {
        try
        {
            _logger.LogInformation("Processing Google OAuth callback with code: {Code}", code?.Substring(0, Math.Min(10, code?.Length ?? 0)) + "...");

            if (string.IsNullOrWhiteSpace(code))
            {
                throw new ArgumentException("Authorization code is required");
            }

            if (string.IsNullOrWhiteSpace(state))
            {
                throw new ArgumentException("State parameter is required");
            }

            // Decode state parameter
            string stateJson;
            try
            {
                // Add padding if needed for Base64Url decoding
                var paddedState = state.PadRight(state.Length + (4 - state.Length % 4) % 4, '=');
                var stateBytes = Convert.FromBase64String(paddedState.Replace('-', '+').Replace('_', '/'));
                stateJson = Encoding.UTF8.GetString(stateBytes);
            }
            catch (Exception ex)
            {
                throw new ArgumentException($"Invalid state parameter: {ex.Message}");
            }

            // Parse state data
            var stateData = JsonSerializer.Deserialize<JsonElement>(stateJson);
            var email = stateData.GetProperty("email").GetString();
            var tenantDomain = stateData.GetProperty("tenantDomain").GetString();

            _logger.LogInformation("Processing callback for email: {Email}, tenant: {TenantDomain}", email, tenantDomain);

            // Get Google OAuth configuration
            var clientId = configuration["Authentication:Google:ClientId"];
            var clientSecret = configuration["Authentication:Google:ClientSecret"];

            if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
            {
                throw new InvalidOperationException("Google OAuth configuration is missing");
            }

            // Exchange authorization code for tokens
            using var httpClient = new HttpClient();
            var tokenRequest = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("code", code),
                new KeyValuePair<string, string>("client_id", clientId),
                new KeyValuePair<string, string>("client_secret", clientSecret),
                new KeyValuePair<string, string>("redirect_uri", "http://localhost:5222/api/auth/google/callback"),
                new KeyValuePair<string, string>("grant_type", "authorization_code")
            });

            var tokenResponse = await httpClient.PostAsync("https://oauth2.googleapis.com/token", tokenRequest);
            var tokenResponseContent = await tokenResponse.Content.ReadAsStringAsync();

            if (!tokenResponse.IsSuccessStatusCode)
            {
                _logger.LogError("Failed to exchange code for tokens: {ResponseContent}", tokenResponseContent);
                throw new InvalidOperationException($"Failed to exchange code for tokens: {tokenResponseContent}");
            }

            var tokenData = JsonSerializer.Deserialize<JsonElement>(tokenResponseContent);
            var accessToken = tokenData.GetProperty("access_token").GetString();
            var idToken = tokenData.GetProperty("id_token").GetString();

            if (string.IsNullOrWhiteSpace(idToken))
            {
                throw new InvalidOperationException("ID token not received from Google");
            }

            // Validate and decode ID token
            var handler = new JwtSecurityTokenHandler();
            var jsonToken = handler.ReadJwtToken(idToken);

            // Extract claims
            var userEmail = jsonToken.Claims.FirstOrDefault(c => c.Type == "email")?.Value;
            var userSub = jsonToken.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;
            var userName = jsonToken.Claims.FirstOrDefault(c => c.Type == "name")?.Value;
            var userPicture = jsonToken.Claims.FirstOrDefault(c => c.Type == "picture")?.Value;

            if (string.IsNullOrWhiteSpace(userEmail))
            {
                throw new InvalidOperationException("Email not found in ID token");
            }

            _logger.LogInformation("Successfully extracted user info from Google ID token: {Email}, {Name}", userEmail, userName);

            // Check if user exists in database
            var user = await _userService.GetByEmailAsync(userEmail, CancellationToken.None);
            if (user == null)
            {
                _logger.LogWarning("User not found in database for email: {Email}", userEmail);
                throw new UnauthorizedAccessException($"User with email {userEmail} is not registered in the system");
            }

            _logger.LogInformation("User found in database: {Email}, UserId: {UserId}", userEmail, user.UserId);

            // Get user roles
            List<string> roleList = ["User"]; // Default role
            try
            {
                var userRoles = await _roleService.GetUserRolesAsync(user.UserId);
                roleList = userRoles.Select(r => r.RoleName).ToList();

                _logger.LogInformation("User roles retrieved: {Email}, Roles: {Roles}", userEmail, string.Join(", ", roleList));
            }
            catch (Exception roleEx)
            {
                _logger.LogWarning(roleEx, "Failed to retrieve user roles for {Email}, using default role 'User'", userEmail);
                // Continue with default role
            }

            // Create application JWT token
            var claims = new List<Claim>
            {
                new Claim("sub", userSub ?? ""),
                new Claim("email", userEmail),
                new Claim("name", userName ?? ""),
                new Claim("picture", userPicture ?? ""),
                new Claim("tenant_domain", tenantDomain ?? ""),
                new Claim("tenant_id", user.TenantId.ToString() ?? ""),
                new Claim("user_id", user.UserId.ToString()),
                new Claim("jti", Guid.NewGuid().ToString())
            };

            // Add each role as a separate ClaimTypes.Role claim
            foreach (var role in roleList)
            {
                claims.Add(new Claim(ClaimTypes.Role, role));
            }

            var jwtTokenString = CreateJwtToken(new ClaimsIdentity(claims), configuration);

            _logger.LogInformation("Successfully generated JWT token for user: {Email}", userEmail);
            return jwtTokenString;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Google OAuth callback. Exception type: {ExceptionType}, Message: {Message}", ex.GetType().Name, ex.Message);
            throw;
        }
    }

    public async Task<string> CreateAppJwtAsync(string email, string name, string tenantDomain, int userId, Guid tenantId, List<string> roles, IConfiguration configuration)
    {
        try
        {
            _logger.LogInformation("Creating application JWT for user: {Email}", email);

            // Create application JWT token
            var claims = new List<Claim>
            {
                new("sub", userId.ToString()),
                new("email", email),
                new("name", name),
                new("picture", ""),
                new("tenant_domain", tenantDomain),
                new("tenant_id", tenantId.ToString()),
                new("user_id", userId.ToString()),
                new("jti", Guid.NewGuid().ToString())
            };

            // Add each role as a separate ClaimTypes.Role claim
            foreach (var role in roles)
            {
                claims.Add(new Claim(ClaimTypes.Role, role));
            }

            var jwtTokenString = CreateJwtToken(new ClaimsIdentity(claims), configuration);

            _logger.LogInformation("Successfully generated JWT token for user: {Email}", email);
            return jwtTokenString;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating application JWT for user: {Email}", email);
            throw;
        }
    }

    /// <summary>
    /// Creates a JWT token with the provided claims and configuration
    /// </summary>
    /// <param name="claims">Claims identity containing user information</param>
    /// <param name="configuration">Application configuration</param>
    /// <returns>JWT token string</returns>
    private static string CreateJwtToken(ClaimsIdentity claims, IConfiguration configuration)
    {
        // Get JWT configuration
        var jwtSecret = configuration["Authentication:Jwt:SecretKey"];
        var jwtIssuer = configuration["Authentication:Jwt:Issuer"];
        var jwtAudience = configuration["Authentication:Jwt:Audience"];
        var jwtExpirationHours = int.Parse(configuration["Authentication:Jwt:ExpirationHours"] ?? "24");

        if (string.IsNullOrWhiteSpace(jwtSecret) || string.IsNullOrWhiteSpace(jwtIssuer) || string.IsNullOrWhiteSpace(jwtAudience))
        {
            throw new InvalidOperationException("JWT configuration is missing");
        }

        // Create JWT token
        var jwtKey = Encoding.UTF8.GetBytes(jwtSecret);
        var handler = new JwtSecurityTokenHandler();
        var jwtDescriptor = new SecurityTokenDescriptor
        {
            Subject = claims,
            Issuer = jwtIssuer,
            Audience = jwtAudience,
            Expires = DateTime.UtcNow.AddHours(jwtExpirationHours),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(jwtKey), SecurityAlgorithms.HmacSha256Signature)
        };

        var jwtToken = handler.CreateToken(jwtDescriptor);
        return handler.WriteToken(jwtToken);
    }
}

using System.ComponentModel.DataAnnotations;

namespace TagIt.Api.Models.Users;

public class UserDto
{
    public int UserId { get; init; }
    public string Email { get; init; } = default!;
    public Guid TenantId { get; init; }
    public bool IsActive { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }
}

public sealed class UserWithRolesDto : UserDto
{
    public List<string> Roles { get; init; } = new();
}

public sealed class UserCreateDto
{
    [Required]
    public Guid TenantId { get; init; }

    [Required, EmailAddress, MaxLength(255)]
    public string Email { get; init; } = default!;

    public List<int> RoleIds { get; init; } = new();
}

public sealed class UserUpdateDto
{
    [Required, EmailAddress, MaxLength(255)]
    public string Email { get; init; } = default!;

    public bool IsActive { get; init; } = true;

    public List<int> RoleIds { get; init; } = new();
}

public sealed class AssignMultipleRolesRequest
{
    [Required]
    public List<int> RoleIds { get; init; } = new();
    
    public DateTime? ExpiresAt { get; init; }
}

public sealed class UserSearchFilters
{
    public string? Search { get; init; }
    public List<string>? Roles { get; init; }
    public bool? IsActive { get; init; }
    public DateTime? CreatedAfter { get; init; }
    public DateTime? CreatedBefore { get; init; }
    public int Skip { get; init; } = 0;
    public int Take { get; init; } = 50;
    public Guid? TenantId { get; init; }
}

public sealed class PagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = Array.Empty<T>();
    public int Skip { get; init; }
    public int Take { get; init; }
    public long Total { get; init; }
}

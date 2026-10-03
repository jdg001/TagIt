using System.ComponentModel.DataAnnotations;

namespace TagIt.Api.Models.Tenants;

public sealed class TenantDto
{
    public Guid TenantId { get; init; }
    public string Name { get; init; } = default!;
    public string Domain { get; init; } = default!;
    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }
}

public sealed class TenantCreateDto
{
    [Required, MaxLength(200)]
    public string Name { get; init; } = default!;

    [Required, MaxLength(255)]
    public string Domain { get; init; } = default!;
}

public sealed class TenantUpdateDto
{
    [Required, MaxLength(200)]
    public string Name { get; init; } = default!;

    [Required, MaxLength(255)]
    public string Domain { get; init; } = default!;
}

public sealed class PagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = Array.Empty<T>();
    public int Skip { get; init; }
    public int Take { get; init; }
    public long Total { get; init; }
}
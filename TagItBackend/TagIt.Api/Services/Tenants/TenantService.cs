using Microsoft.EntityFrameworkCore;
using TagIt.Api.Models.Tenants;
using TagIt.Api.Providers.Tenants;

namespace TagIt.Api.Services.Tenants;

public sealed class TenantService(ITenantProvider provider) : ITenantService
{
    private readonly ITenantProvider _provider = provider;

    public async Task<PagedResult<TenantDto>> GetAllAsync(string? search, int skip, int take, CancellationToken ct)
    {
        take = Math.Clamp(take, 1, 200);

        var q = _provider.Query().AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(t => t.Name.Contains(s) || t.Domain.Contains(s));
        }

        var total = await q.LongCountAsync(ct);

        var items = await q.OrderBy(t => t.Name)
            .Skip(skip)
            .Take(take)
            .Select(t => t.ToDto())
            .ToListAsync(ct);

        return new PagedResult<TenantDto>
        {
            Items = items,
            Skip = skip,
            Take = take,
            Total = total
        };
    }

    public async Task<TenantDto?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var entity = await _provider.Query().AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == id, ct);
        return entity?.ToDto();
    }

    public async Task<TenantDto?> GetByDomainAsync(string domain, CancellationToken ct)
    {
        var entity = await _provider.Query().AsNoTracking()
            .FirstOrDefaultAsync(x => x.Domain == domain, ct);
        return entity?.ToDto();
    }

    public async Task<(TenantDto? result, string? error)> CreateAsync(TenantCreateDto dto, CancellationToken ct)
    {
        // Business rule: Domain must be unique
        if (await _provider.ExistsByDomainAsync(dto.Domain.Trim(), excludeId: null, ct))
            return (null, $"Domain '{dto.Domain}' is already in use.");

        var entity = new Tenant
        {
            Name = dto.Name.Trim(),
            Domain = dto.Domain.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        await _provider.AddAsync(entity, ct);
        await _provider.SaveChangesAsync(ct);

        return (entity.ToDto(), null);
    }

    public async Task<(TenantDto? result, string? error)> UpdateAsync(Guid id, TenantUpdateDto dto, CancellationToken ct)
    {
        var entity = await _provider.GetByIdAsync(id, ct);
        if (entity is null) return (null, "NotFound");

        if (await _provider.ExistsByDomainAsync(dto.Domain.Trim(), excludeId: id, ct))
            return (null, $"Domain '{dto.Domain}' is already in use.");

        entity.Name = dto.Name.Trim();
        entity.Domain = dto.Domain.Trim();
        entity.UpdatedAt = DateTime.UtcNow;

        await _provider.SaveChangesAsync(ct);
        return (entity.ToDto(), null);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _provider.GetByIdAsync(id, ct);
        if (entity is null) return false;

        await _provider.RemoveAsync(entity, ct);
        await _provider.SaveChangesAsync(ct);
        return true;
    }
}

// Mapping helper
internal static class TenantMapping
{
    public static TenantDto ToDto(this Tenant t) => new()
    {
        TenantId = t.TenantId,
        Name = t.Name,
        Domain = t.Domain,
        CreatedAt = t.CreatedAt,
        UpdatedAt = t.UpdatedAt
    };
}

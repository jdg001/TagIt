using Microsoft.EntityFrameworkCore;
using TagIt.Api.Data;
using TagIt.Api.Models.Tenants;

namespace TagIt.Api.Providers.Tenants;

public sealed class TenantProvider(AppDb db) : ITenantProvider
{
    private readonly AppDb _db = db;

    public IQueryable<Tenant> Query() => _db.Tenants;

    public Task<Tenant?> GetByIdAsync(Guid id, CancellationToken ct) =>
        _db.Tenants.FirstOrDefaultAsync(x => x.TenantId == id, ct);

    public Task<Tenant?> GetByDomainAsync(string domain, CancellationToken ct) =>
        _db.Tenants.FirstOrDefaultAsync(x => x.Domain == domain, ct);

    public Task<bool> ExistsByDomainAsync(string domain, Guid? excludeId, CancellationToken ct) =>
        _db.Tenants.AnyAsync(x => x.Domain == domain && (excludeId == null || x.TenantId != excludeId), ct);

    public async Task AddAsync(Tenant entity, CancellationToken ct) =>
        await _db.Tenants.AddAsync(entity, ct);

    public Task RemoveAsync(Tenant entity, CancellationToken ct)
    {
        _db.Tenants.Remove(entity);
        return Task.CompletedTask;
    }

    public Task<int> SaveChangesAsync(CancellationToken ct) => _db.SaveChangesAsync(ct);
}

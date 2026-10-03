
using TagIt.Api.Models.Tenants;

namespace TagIt.Api.Providers.Tenants;

public interface ITenantProvider
{
    IQueryable<Tenant> Query(); 
    Task<Tenant?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<Tenant?> GetByDomainAsync(string domain, CancellationToken ct);
    Task<bool> ExistsByDomainAsync(string domain, Guid? excludeId, CancellationToken ct);

    Task AddAsync(Tenant entity, CancellationToken ct);
    Task RemoveAsync(Tenant entity, CancellationToken ct);
    Task<int> SaveChangesAsync(CancellationToken ct);
}

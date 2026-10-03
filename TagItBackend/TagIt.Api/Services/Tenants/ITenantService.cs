using TagIt.Api.Models.Tenants;

namespace TagIt.Api.Services.Tenants;

public interface ITenantService
{
    Task<PagedResult<TenantDto>> GetAllAsync(string? search, int skip, int take, CancellationToken ct);
    Task<TenantDto?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<TenantDto?> GetByDomainAsync(string domain, CancellationToken ct);
    Task<(TenantDto? result, string? error)> CreateAsync(TenantCreateDto dto, CancellationToken ct);
    Task<(TenantDto? result, string? error)> UpdateAsync(Guid id, TenantUpdateDto dto, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
}

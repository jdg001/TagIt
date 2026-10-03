using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TagIt.Api.Models.Tenants;
using TagIt.Api.Services.Tenants;

namespace TagIt.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class TenantsController(ITenantService service) : ControllerBase
{
    private readonly ITenantService _service = service;

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<PagedResult<TenantDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var result = await _service.GetAllAsync(search, skip, take, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<TenantDto>> GetById(Guid id, CancellationToken ct = default)
    {
        var dto = await _service.GetByIdAsync(id, ct);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpGet("by-domain/{domain}")]
    [AllowAnonymous]
    public async Task<ActionResult<TenantDto>> GetByDomain(string domain, CancellationToken ct = default)
    {
        var dto = await _service.GetByDomainAsync(domain, ct);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpPost]
    [AllowAnonymous]
    public async Task<ActionResult<TenantDto>> Create([FromBody] TenantCreateDto dto, CancellationToken ct = default)
    {
        var (result, error) = await _service.CreateAsync(dto, ct);
        if (error is not null) return Conflict(new { message = error });
        return CreatedAtAction(nameof(GetById), new { id = result!.TenantId }, result);
    }

    [HttpPut("{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<TenantDto>> Update(Guid id, [FromBody] TenantUpdateDto dto, CancellationToken ct = default)
    {
        var (result, error) = await _service.UpdateAsync(id, dto, ct);
        if (error is "NotFound") return NotFound();
        if (error is not null) return Conflict(new { message = error });
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var ok = await _service.DeleteAsync(id, ct);
        if (!ok) return NotFound();
        return NoContent();
    }
}

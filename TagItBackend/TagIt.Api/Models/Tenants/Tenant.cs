using System.ComponentModel.DataAnnotations;

namespace TagIt.Api.Models.Tenants
{
    public sealed class Tenant
    {
        [Key]
        public Guid TenantId { get; set; } = Guid.NewGuid();

        [Required, MaxLength(200)]
        public string Name { get; set; } = default!;

        [Required, MaxLength(255)]
        public string Domain { get; set; } = default!;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}

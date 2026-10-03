using System.ComponentModel.DataAnnotations;
using TagIt.Api.Models.Tenants;

namespace TagIt.Api.Models.Users;

public class User
{
    [Key]
    public int UserId { get; set; }

    [Required, MaxLength(255)]
    public string Email { get; set; } = default!;

    [Required]
    public Guid TenantId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public bool IsActive { get; set; } = true;

    [MaxLength(255)]
    public string? PasswordHash { get; set; }

    public Tenant? Tenant { get; set; }

    // Navigation properties
    public virtual ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public virtual ICollection<DesignState> DesignStates { get; set; } = new List<DesignState>();
    public virtual ICollection<DesignState> ReviewedStates { get; set; } = new List<DesignState>();
    public virtual ICollection<DesignState> PublishedStates { get; set; } = new List<DesignState>();
}

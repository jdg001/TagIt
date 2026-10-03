using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using TagIt.Api.Models.Users;

namespace TagIt.Api.Models;

// Entity Models for Database Tables
public class RolesLookUp
{
    [Key]
    public int RoleId { get; set; }
    
    [Required]
    [StringLength(50)]
    public string RoleName { get; set; } = string.Empty;
    
    [StringLength(200)]
    public string? RoleDescription { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
}

public class UserRole
{ 
    [Key, Column(Order = 0)]
    public int UserId { get; set; }
    
    [Key, Column(Order = 1)]
    public int RoleId { get; set; }
    
    public int? AssignedBy { get; set; }
    
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? ExpiresAt { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation properties
    [ForeignKey("UserId")]
    public virtual User User { get; set; } = null!;
    
    [ForeignKey("RoleId")]
    public virtual RolesLookUp Role { get; set; } = null!;
    
    [ForeignKey("AssignedBy")]
    public virtual User? AssignedByUser { get; set; }
}

public class DesignState
{
    [Key]
    public int DesignStateId { get; set; }
    
    [Required]
    public int TemplateId { get; set; }
    
    [Required]
    public int DesignerId { get; set; }
    
    public int? ReviewerId { get; set; }
    
    [Required]
    [StringLength(20)]
    public string State { get; set; } = string.Empty;
    
    [Required]
    public int VersionNumber { get; set; } = 1;
    
    public string? Comments { get; set; }
    
    public DateTime? StateChangedAt { get; set; }
    
    [Required]
    public int StateChangedBy { get; set; }
    
    public bool IsPublished { get; set; } = false;
    
    public DateTime? PublishedAt { get; set; }
    
    public int? PublishedBy { get; set; }
    
    // Navigation properties
    [ForeignKey("TemplateId")]
    public virtual LabelTemplate Template { get; set; } = null!;
    
    [ForeignKey("DesignerId")]
    public virtual User Designer { get; set; } = null!;
    
    [ForeignKey("ReviewerId")]
    public virtual User? Reviewer { get; set; }
    
    [ForeignKey("StateChangedBy")]
    public virtual User StateChangedByUser { get; set; } = null!;
    
    [ForeignKey("PublishedBy")]
    public virtual User? PublishedByUser { get; set; }
    
    // Navigation property for canvas comments
    public virtual ICollection<Comment> CanvasComments { get; set; } = new List<Comment>();
}

// User entity (assuming this exists or needs to be created)
//public class User
//{
//    [Key]
//    public int UserId { get; set; }
    
//    [Required]
//    [StringLength(255)]
//    public string Username { get; set; } = string.Empty;
    
//    // Navigation properties
//    public virtual ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
//    public virtual ICollection<DesignState> DesignStates { get; set; } = new List<DesignState>();
//    public virtual ICollection<DesignState> ReviewedStates { get; set; } = new List<DesignState>();
//    public virtual ICollection<DesignState> PublishedStates { get; set; } = new List<DesignState>();
//}

// Comment entity for canvas comments
public class Comment
{
    [Key]
    public int CommentId { get; set; }
    
    [Required]
    public int DesignStateId { get; set; }
    
    [Required]
    public string CommentText { get; set; } = string.Empty;
    
    [Required]
    [Column(TypeName = "decimal(10,2)")]
    public decimal PositionX { get; set; } // Paper-relative X coordinate
    
    [Required]
    [Column(TypeName = "decimal(10,2)")]
    public decimal PositionY { get; set; } // Paper-relative Y coordinate
    
    // [NEW] Paper layout context when comment was created
    [Required]
    [Column(TypeName = "decimal(10,2)")]
    public decimal PaperLayoutLeft { get; set; }
    
    [Required]
    [Column(TypeName = "decimal(10,2)")]
    public decimal PaperLayoutTop { get; set; }
    
    [Required]
    [Column(TypeName = "decimal(10,2)")]
    public decimal PaperLayoutWidth { get; set; }
    
    [Required]
    [Column(TypeName = "decimal(10,2)")]
    public decimal PaperLayoutHeight { get; set; }
    
    [Required]
    public int CreatedBy { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    public int? UpdatedBy { get; set; }
    
    public bool IsResolved { get; set; } = false;
    
    public DateTime? ResolvedAt { get; set; }
    
    public int? ResolvedBy { get; set; }
    
    public string? ResponseText { get; set; } // Designer's optional response
    
    // Navigation properties
    [ForeignKey("DesignStateId")]
    public virtual DesignState DesignState { get; set; } = null!;
    
    [ForeignKey("CreatedBy")]
    public virtual User CreatedByUser { get; set; } = null!;
    
    [ForeignKey("UpdatedBy")]
    public virtual User? UpdatedByUser { get; set; }
    
    [ForeignKey("ResolvedBy")]
    public virtual User? ResolvedByUser { get; set; }
}

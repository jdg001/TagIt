using System.ComponentModel.DataAnnotations;

namespace TagIt.Api.Models;

// Comment DTO for API responses
public class CommentDto
{
    public int CommentId { get; set; }
    public int DesignStateId { get; set; }
    public string CommentText { get; set; } = string.Empty;
    public decimal PositionX { get; set; } // Paper-relative X coordinate
    public decimal PositionY { get; set; } // Paper-relative Y coordinate
    // [NEW] Paper layout context
    public decimal PaperLayoutLeft { get; set; }
    public decimal PaperLayoutTop { get; set; }
    public decimal PaperLayoutWidth { get; set; }
    public decimal PaperLayoutHeight { get; set; }
    public int CreatedBy { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public string? UpdatedByName { get; set; }
    public bool IsResolved { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public int? ResolvedBy { get; set; }
    public string? ResolvedByName { get; set; }
    public string? ResponseText { get; set; } // Designer's optional response
}

// Create comment request
public class CreateCommentRequest
{
    [Required]
    public int DesignStateId { get; set; }
    
    [Required]
    [StringLength(1000, MinimumLength = 1)]
    public string CommentText { get; set; } = string.Empty;
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PositionX { get; set; } // Paper-relative X coordinate
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PositionY { get; set; } // Paper-relative Y coordinate
    
    // [NEW] Paper layout context
    [Required]
    [Range(0, 9999.99)]
    public decimal PaperLayoutLeft { get; set; }
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PaperLayoutTop { get; set; }
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PaperLayoutWidth { get; set; }
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PaperLayoutHeight { get; set; }
    
    [Required]
    public int CreatedBy { get; set; }
}

// Update comment request
public class UpdateCommentRequest
{
    [Required]
    public int CommentId { get; set; }
    
    [Required]
    [StringLength(1000, MinimumLength = 1)]
    public string CommentText { get; set; } = string.Empty;
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PositionX { get; set; } // Paper-relative X coordinate
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PositionY { get; set; } // Paper-relative Y coordinate
    
    // [NEW] Paper layout context
    [Required]
    [Range(0, 9999.99)]
    public decimal PaperLayoutLeft { get; set; }
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PaperLayoutTop { get; set; }
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PaperLayoutWidth { get; set; }
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PaperLayoutHeight { get; set; }
    
    [Required]
    public int UpdatedBy { get; set; }
}

// Resolve comment request
public class ResolveCommentRequest
{
    [Required]
    public int CommentId { get; set; }
    
    [Required]
    public int ResolvedBy { get; set; }
    
    public string? ResponseText { get; set; } // Optional designer response
}

// Delete comment request
public class DeleteCommentRequest
{
    [Required]
    public int CommentId { get; set; }
}

// Bulk create comments request (for rejection workflow)
public class BulkCreateCommentsRequest
{
    [Required]
    public int DesignStateId { get; set; }
    
    [Required]
    public int CreatedBy { get; set; }
    
    // [NEW] Paper layout context for all comments in this bulk request
    [Required]
    [Range(0, 9999.99)]
    public decimal PaperLayoutLeft { get; set; }
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PaperLayoutTop { get; set; }
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PaperLayoutWidth { get; set; }
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PaperLayoutHeight { get; set; }
    
    [Required]
    public List<CommentData> Comments { get; set; } = new();
}

public class CommentData
{
    [Required]
    [StringLength(1000, MinimumLength = 1)]
    public string CommentText { get; set; } = string.Empty;
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PositionX { get; set; } // Paper-relative X coordinate
    
    [Required]
    [Range(0, 9999.99)]
    public decimal PositionY { get; set; } // Paper-relative Y coordinate
}

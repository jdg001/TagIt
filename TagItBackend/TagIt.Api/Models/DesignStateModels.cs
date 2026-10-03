using System.ComponentModel.DataAnnotations;

namespace TagIt.Api.Models;

// Design State DTOs
public class DesignStateDto
{
    public int DesignStateId { get; set; }
    public int TemplateId { get; set; }
    public int DesignerId { get; set; }
    public string? DesignerName { get; set; }

    public int? ReviewerId { get; set; }
    public string? ReviewerName { get; set; }

    public string State { get; set; } = string.Empty;
    public int VersionNumber { get; set; }
    public string? Comments { get; set; }

    public DateTime? StateChangedAt { get; set; }
    public int StateChangedBy { get; set; }
    public string? StateChangedByName { get; set; }

    public bool IsPublished { get; set; }
    public DateTime? PublishedAt { get; set; }
    public int? PublishedBy { get; set; }
    public string? PublishedByName { get; set; }
}

public class CreateDesignStateRequest
{
    [Required]
    public int TemplateId { get; set; }
    
    [Required]
    public int DesignerId { get; set; }
    
    public int? ReviewerId { get; set; }
    
    [Required]
    [StringLength(20)]
    public string State { get; set; } = string.Empty;
    
    [Required]
    public int VersionNumber { get; set; }
    
    public string? Comments { get; set; }

    public DateTime? StateChangedAt { get; set; }

    public bool IsPublished { get; set; }

    public int? PublishedBy { get; set; }

    public DateTime? PublishedAt { get; set; }

    [Required]
    public int StateChangedBy { get; set; }
}

public class UpdateDesignStateRequest
{
    [Required]
    [StringLength(20)]
    public string NewState { get; set; } = string.Empty;
    
    public string? Comments { get; set; }
    
    public int? ReviewerId { get; set; }

    public DateTime? StateChangedAt { get; set; }

    [Required]
    public int StateChangedBy { get; set; }
}

// Workflow Request DTOs
public class SubmitForReviewRequest
{
    public int DesignStateId { get; set; }

    public int? ReviewerId { get; set; }
    
    public string? Comments { get; set; }

    public DateTime? StateChangedAt { get; set; }

    public int? StateChangedBy { get; set; }
    
    public bool IsDeleteRequest { get; set; } = false;
}

public class ApproveTemplateRequest
{
    public int DesignStateId { get; set; }
    
    public string? Comments { get; set; }

    public DateTime? StateChangedAt { get; set; }

    [Required]
    public int StateChangedBy { get; set; }
}

public class RejectTemplateRequest
{
    public int DesignStateId { get; set; }
    
    [Required]
    public string Comments { get; set; } = string.Empty;

    public DateTime? StateChangedAt { get; set; }

    [Required]
    public int StateChangedBy { get; set; }
}

public class PublishTemplateRequest
{
    public int DesignStateId { get; set; }

    public DateTime? StateChangedAt { get; set; }

    [Required]
    public int StateChangedBy { get; set; }
    
    public string? Comments { get; set; }

    public bool IsPublished { get; set; }

    public int? PublishedBy { get; set; }

    public DateTime? PublishedAt { get; set; }
}

// Assign/Unassign Request DTOs
public class AssignReviewerRequest
{
    public int DesignStateId { get; set; }
    
    [Required]
    public int ReviewerId { get; set; }
    
    [Required]
    public int AssignedBy { get; set; }
    
    public string? Comments { get; set; }
}

public class UnassignReviewerRequest
{
    public int DesignStateId { get; set; }
    
    [Required]
    public int UnassignedBy { get; set; }
    
    public string? Comments { get; set; }
}

// Stored Procedure Result DTO
public class SpResult
{
    public string Result { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

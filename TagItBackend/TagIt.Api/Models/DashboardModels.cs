using System.ComponentModel.DataAnnotations;

namespace TagIt.Api.Models;

// Dashboard DTOs
public class DashboardTemplateDto
{
    public int TemplateId { get; set; }
    public int? DesignStateId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? DesignerId { get; set; }
    public string? DesignerName { get; set; }
    public string? ReviewerName { get; set; }
    public int? ReviewerId { get; set; }
    public string State { get; set; } = string.Empty;
    public int VersionNumber { get; set; }
    public DateTime? PublishedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class DashboardStatsDto
{
    public int TotalTemplates { get; set; }
    public int PublishedTemplates { get; set; }
    public int DraftTemplates { get; set; }
    public int UnderReviewTemplates { get; set; }
    public int ApprovedTemplates { get; set; }
    public int RejectedTemplates { get; set; }
    public int TotalDesigners { get; set; }
    public int TotalReviewers { get; set; }
    public int ActiveDesigners { get; set; }
    public int ActiveReviewers { get; set; }
}

public class ReviewerDto
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
}

// Request DTOs
public class GetTemplatesByLibraryRequest
{
    [Required]
    public string LibraryType { get; set; } = string.Empty;
    
    [Required]
    public int UserId { get; set; }
}

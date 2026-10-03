using System.ComponentModel.DataAnnotations;

namespace TagIt.Api.Models;

public class LabelTemplate
{
    [Key]
    public int TemplateId { get; set; }
    public Guid? TenantId { get; set; }
    [Required, MaxLength(200)]
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public decimal PaperWidth { get; set; }
    public decimal PaperHeight { get; set; }
    public string Unit { get; set; } = "inch"; // inch|mm|px
    [Required]
    public string JsonSchema { get; set; } = default!;
    public bool IsPublished { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

}

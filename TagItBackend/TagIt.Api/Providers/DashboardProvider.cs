using Microsoft.EntityFrameworkCore;
using TagIt.Api.Data;
using TagIt.Api.Models;

namespace TagIt.Api.Providers;

public class DashboardProvider : IDashboardProvider
{
    private readonly AppDb _context;
    private readonly ILogger<DashboardProvider> _logger;

    public DashboardProvider(AppDb context, ILogger<DashboardProvider> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<IEnumerable<DashboardTemplateDto>> GetTemplatesByLibraryAsync(string libraryType, int userId)
    {
        try
        {
            var templates = new List<DashboardTemplateDto>();

            switch (libraryType.ToLower())
            {
                case "public":
                    // Get published templates (exclude delete request states)
                    templates = await _context.DesignState
                        .Where(ds => ds.IsPublished && ds.State == "Published")
                        .Include(ds => ds.Template)
                        .Include(ds => ds.Designer)
                        .Select(ds => new DashboardTemplateDto
                        {
                            TemplateId = ds.TemplateId,
                            Name = ds.Template.Name,
                            Description = ds.Template.Description,
                            DesignerId = ds.DesignerId,
                            DesignerName = ds.Designer.Email,
                            State = ds.State,
                            VersionNumber = ds.VersionNumber,
                            PublishedAt = ds.PublishedAt,
                            CreatedAt = ds.Template.CreatedAt
                        })
                        .ToListAsync();
                    break;

                case "local":
                    // Get user's draft and rejected templates
                    templates = await _context.DesignState
                        .Where(ds => ds.DesignerId == userId && (ds.State == "Draft" || ds.State == "Rejected"))
                        .Include(ds => ds.Template)
                        .Select(ds => new DashboardTemplateDto
                        {
                            TemplateId = ds.TemplateId,
                            DesignStateId = ds.DesignStateId,
                            Name = ds.Template.Name,
                            Description = ds.Template.Description,
                            DesignerId = ds.DesignerId,
                            State = ds.State,
                            VersionNumber = ds.VersionNumber,
                            CreatedAt = ds.Template.CreatedAt
                        })
                        .ToListAsync();
                    break;

                case "submitted":
                    // Get user's submitted templates
                    templates = await _context.DesignState
                        .Where(ds => ds.DesignerId == userId && ds.State == "UnderReview" || ds.State == "Assigned" || ds.State == "Approved")
                        .Include(ds => ds.Template)
                        .Include(ds => ds.Reviewer)
                        .Select(ds => new DashboardTemplateDto
                        {
                            TemplateId = ds.TemplateId,
                            DesignStateId = ds.DesignStateId,
                            Name = ds.Template.Name,
                            Description = ds.Template.Description,
                            DesignerId = ds.DesignerId,
                            State = ds.State,
                            VersionNumber = ds.VersionNumber,
                            ReviewerName = ds.Reviewer != null ? ds.Reviewer.Email : "Any Reviewer",
                            SubmittedAt = ds.StateChangedAt,
                            CreatedAt = ds.Template.CreatedAt
                        })
                        .ToListAsync();
                    break;

                case "all-submissions":
                    // Get all submitted templates for reviewers (including delete request states)
                    templates = await _context.DesignState
                        .Where(ds => ds.State == "UnderReview" || ds.State == "Assigned" || ds.State == "DeleteUnderReview" || ds.State == "DeleteAssigned" || ds.State == "DeleteApproved")
                        .Include(ds => ds.Template)
                        .Include(ds => ds.Designer)
                        .Include(ds => ds.Reviewer)
                        .Select(ds => new DashboardTemplateDto
                        {
                            TemplateId = ds.TemplateId,
                            DesignStateId = ds.DesignStateId,
                            Name = ds.Template.Name,
                            Description = ds.Template.Description,
                            DesignerId = ds.DesignerId,
                            DesignerName = ds.Designer.Email,
                            State = ds.State,
                            VersionNumber = ds.VersionNumber,
                            ReviewerName = ds.Reviewer != null ? ds.Reviewer.Email : "Any Reviewer",
                            SubmittedAt = ds.StateChangedAt,
                            CreatedAt = ds.Template.CreatedAt
                        })
                        .ToListAsync();
                    break;

                case "assigned":
                    // Get templates assigned to specific reviewer (UnderReview, Approved, Assigned, and Delete request states)
                    templates = await _context.DesignState
                        .Where(ds => ds.ReviewerId == userId && (ds.State == "UnderReview" || ds.State == "Approved" || ds.State == "Assigned" || ds.State == "DeleteUnderReview" || ds.State == "DeleteAssigned" || ds.State == "DeleteApproved"))
                        .Include(ds => ds.Template)
                        .Include(ds => ds.Designer)
                        .Select(ds => new DashboardTemplateDto
                        {
                            TemplateId = ds.TemplateId,
                            DesignStateId = ds.DesignStateId,
                            Name = ds.Template.Name,
                            Description = ds.Template.Description,
                            DesignerId = ds.DesignerId,
                            DesignerName = ds.Designer.Email,
                            ReviewerName = ds.Reviewer.Email,
                            ReviewerId = ds.ReviewerId,
                            State = ds.State,
                            VersionNumber = ds.VersionNumber,
                            SubmittedAt = ds.StateChangedAt,
                            CreatedAt = ds.Template.CreatedAt
                        })
                        .ToListAsync();
                    break;
            }

            return templates;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting templates by library type: {LibraryType} for user: {UserId}", libraryType, userId);
            throw;
        }
    }

    public async Task<IEnumerable<ReviewerDto>> GetReviewersAsync()
    {
        try
        {
            var reviewers = await _context.Users
                .Where(u => u.UserRoles.Any(ur => ur.Role.RoleName == "Reviewer"))
                .Select(u => new ReviewerDto
                {
                    UserId = u.UserId,
                    Username = u.Email
                })
                .ToListAsync();

            return reviewers;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting reviewers list");
            throw;
        }
    }

    public async Task<DashboardStatsDto> GetDashboardStatsAsync()
    {
        try
        {
            var totalTemplates = await _context.LabelTemplates.CountAsync();
            var publishedTemplates = await _context.DesignState.CountAsync(ds => ds.IsPublished);
            var draftTemplates = await _context.DesignState.CountAsync(ds => ds.State == "Draft");
            var underReviewTemplates = await _context.DesignState.CountAsync(ds => ds.State == "UnderReview");
            var approvedTemplates = await _context.DesignState.CountAsync(ds => ds.State == "Approved");
            var rejectedTemplates = await _context.DesignState.CountAsync(ds => ds.State == "Rejected");

            var totalDesigners = await _context.Users
                .CountAsync(u => u.UserRoles.Any(ur => ur.Role.RoleName == "Designer"));
            var totalReviewers = await _context.Users
                .CountAsync(u => u.UserRoles.Any(ur => ur.Role.RoleName == "Reviewer"));

            // Active users are those who have created or modified design states in the last 30 days
            var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
            var activeDesigners = await _context.DesignState
                .Where(ds => ds.StateChangedAt >= thirtyDaysAgo)
                .Select(ds => ds.DesignerId)
                .Distinct()
                .CountAsync();

            var activeReviewers = await _context.DesignState
                .Where(ds => ds.StateChangedAt >= thirtyDaysAgo && ds.ReviewerId.HasValue)
                .Select(ds => ds.ReviewerId!.Value)
                .Distinct()
                .CountAsync();

            return new DashboardStatsDto
            {
                TotalTemplates = totalTemplates,
                PublishedTemplates = publishedTemplates,
                DraftTemplates = draftTemplates,
                UnderReviewTemplates = underReviewTemplates,
                ApprovedTemplates = approvedTemplates,
                RejectedTemplates = rejectedTemplates,
                TotalDesigners = totalDesigners,
                TotalReviewers = totalReviewers,
                ActiveDesigners = activeDesigners,
                ActiveReviewers = activeReviewers
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting dashboard statistics");
            throw;
        }
    }
}

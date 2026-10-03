using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Reflection.Metadata.Ecma335;
using TagIt.Api.Data;
using TagIt.Api.Models;

namespace TagIt.Api.Providers;

public class DesignStateProvider : IDesignStateProvider
{
    private readonly AppDb _context;
    private readonly ILogger<DesignStateProvider> _logger;

    public DesignStateProvider(AppDb context, ILogger<DesignStateProvider> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<IEnumerable<DesignStateDto>> GetAllDesignStatesAsync()
    {
        try
        {
            var designStates = await _context.DesignState
                .Include(ds => ds.Template)
                .Include(ds => ds.Designer)
                .Include(ds => ds.Reviewer)
                .Include(ds => ds.StateChangedByUser)
                .Include(ds => ds.PublishedByUser)
                .Select(ds => new DesignStateDto
                {
                    DesignStateId = ds.DesignStateId,
                    TemplateId = ds.TemplateId,
                    DesignerId = ds.DesignerId,
                    DesignerName = ds.Designer.Email,
                    ReviewerId = ds.ReviewerId,
                    ReviewerName = ds.Reviewer != null ? ds.Reviewer.Email : null,
                    State = ds.State,
                    VersionNumber = ds.VersionNumber,
                    Comments = ds.Comments,
                    StateChangedAt = ds.StateChangedAt,
                    StateChangedBy = ds.StateChangedBy,
                    StateChangedByName = ds.StateChangedByUser.Email,
                    IsPublished = ds.IsPublished,
                    PublishedAt = ds.PublishedAt,
                    PublishedBy = ds.PublishedBy,
                })
                .ToListAsync();
            return designStates;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all design states");
            throw;
        }
    }

    public async Task<DesignStateDto?> GetDesignStateByIdAsync(int designStateId)
    {
        try
        {
            var designState = await _context.DesignState
            .Include(ds => ds.Template)
            .Include(ds => ds.Designer)
            .Include(ds => ds.Reviewer)
            .Include(ds => ds.StateChangedByUser)
            .Include(ds => ds.PublishedByUser)
            .Where(ds => ds.DesignStateId == designStateId)
            .Select(ds => new DesignStateDto
            {
                DesignStateId = ds.DesignStateId,
                TemplateId = ds.TemplateId,
                DesignerId = ds.DesignerId,
                DesignerName = ds.Designer != null ? ds.Designer.Email : string.Empty,

                ReviewerId = ds.ReviewerId,
                ReviewerName = ds.Reviewer != null ? ds.Reviewer.Email : null,

                State = ds.State ?? string.Empty,             // handle null safely
                VersionNumber = ds.VersionNumber,        // handle nullable int
                Comments = ds.Comments,

                StateChangedAt = ds.StateChangedAt,           // keep nullable
                StateChangedBy = ds.StateChangedBy,     // handle nullable int
                StateChangedByName = ds.StateChangedByUser != null ? ds.StateChangedByUser.Email : null,

                IsPublished = ds.IsPublished,       // handle nullable bool
                PublishedAt = ds.PublishedAt,
                PublishedBy = ds.PublishedBy,
                PublishedByName = ds.PublishedByUser != null ? ds.PublishedByUser.Email : null
            })
            .FirstOrDefaultAsync();

            return designState;

        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting design state by ID: {DesignStateId}", designStateId);
            throw;
        }
    }

    public async Task<DesignStateDto> CreateDesignStateAsync(CreateDesignStateRequest request)
    {
        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_CreateDesignState @TemplateId, @DesignerId, @ReviewerId, @State, @VersionNumber, @Comments, @StateChangedAt, @StateChangedBy, @IsPublished, @PublishedBy, @PublishedAt",
                new SqlParameter("@TemplateId", request.TemplateId),
                new SqlParameter("@DesignerId", request.DesignerId),
                new SqlParameter("@ReviewerId", request.ReviewerId ?? (object)DBNull.Value),
                new SqlParameter("@State", request.State),
                new SqlParameter("@VersionNumber", request.VersionNumber),
                new SqlParameter("@Comments", request.Comments ?? (object)DBNull.Value),
                new SqlParameter("@StateChangedAt", request.StateChangedAt ?? DateTime.UtcNow),
                new SqlParameter("@StateChangedBy", request.StateChangedBy),
                new SqlParameter("@IsPublished", request.IsPublished),
                new SqlParameter("@PublishedBy", request.PublishedBy ?? (object)DBNull.Value),
                new SqlParameter("@PublishedAt", request.PublishedAt ?? (object)DBNull.Value)
            );

            // Get the created design state
            var designState = await GetCurrentTemplateStateAsync(request.TemplateId);
            return designState ?? throw new InvalidOperationException("Failed to retrieve created design state");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating design state for template: {TemplateId}", request.TemplateId);
            throw;
        }
    }

    public async Task<DesignStateDto> UpdateDesignStateAsync(int designStateId, UpdateDesignStateRequest request)
    {
        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_UpdateDesignState @DesignStateId, @NewState, @Comments, @StateChangedAt, @StateChangedBy, @ReviewerId",
                new SqlParameter("@DesignStateId", designStateId),
                new SqlParameter("@NewState", request.NewState),
                new SqlParameter("@Comments", request.Comments ?? (object)DBNull.Value),
                new SqlParameter("@StateChangedAt", request.StateChangedAt ?? (object)DBNull.Value),
                new SqlParameter("@StateChangedBy", request.StateChangedBy),
                new SqlParameter("@ReviewerId", request.ReviewerId ?? (object)DBNull.Value)
            );

            // Get the updated design state
            var designState = await GetDesignStateByIdAsync(designStateId);
            return designState ?? throw new InvalidOperationException("Failed to retrieve updated design state");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating design state: {DesignStateId}", designStateId);
            throw;
        }
    }

    public async Task<bool> DeleteDesignStateAsync(int designStateId)
    {
        try
        {
            var designState = await _context.DesignState.FindAsync(designStateId);
            if (designState == null)
                return false;

            _context.DesignState.Remove(designState);
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting design state: {DesignStateId}", designStateId);
            throw;
        }
    }

    public async Task<DesignStateDto?> GetCurrentTemplateStateAsync(int templateId)
    {
        try
        {
            var result = await _context.Database.SqlQueryRaw<DesignStateDto>(
                "EXEC sp_GetCurrentTemplateState @TemplateId",
                new SqlParameter("@TemplateId", templateId)
            ).ToListAsync();
            return result.FirstOrDefault();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting current template state for template: {TemplateId}", templateId);
            throw;
        }
    }

    public async Task<IEnumerable<DesignStateDto>> GetTemplateStatesAsync(int templateId)
    {
        try
        {
            var states = await _context.Database.SqlQueryRaw<DesignStateDto>(
                "EXEC sp_GetTemplateStates @TemplateId",
                new SqlParameter("@TemplateId", templateId)
            ).ToListAsync();
            return states;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting template states for template: {TemplateId}", templateId);
            throw;
        }
    }

    public async Task<DesignStateDto> ApproveTemplateAsync(ApproveTemplateRequest request)
    {
        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_ApproveTemplate @DesignStateId, @Comments, @StateChangedBy",
                new SqlParameter("@DesignStateId", request.DesignStateId),
                new SqlParameter("@Comments", request.Comments ?? (object)DBNull.Value),
                new SqlParameter("@StateChangedBy", request.StateChangedBy)
            );

            var designState = await GetDesignStateByIdAsync(request.DesignStateId);
            return designState ?? throw new InvalidOperationException("Failed to retrieve updated design state");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error approving template: {DesignStateId}", request.DesignStateId);
            throw;
        }
    }

    public async Task<DesignStateDto> RejectTemplateAsync(RejectTemplateRequest request)
    {
        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_RejectTemplate @DesignStateId, @Comments, @StateChangedBy",
                new SqlParameter("@DesignStateId", request.DesignStateId),
                new SqlParameter("@Comments", request.Comments),
                new SqlParameter("@StateChangedBy", request.StateChangedBy)
            );

            var designState = await GetDesignStateByIdAsync(request.DesignStateId);
            return designState ?? throw new InvalidOperationException("Failed to retrieve updated design state");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rejecting template: {DesignStateId}", request.DesignStateId);
            throw;
        }
    }

    public async Task<DesignStateDto> PublishTemplateAsync(PublishTemplateRequest request)
    {
        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_PublishTemplate @DesignStateId, @StateChangedBy",
                new SqlParameter("@DesignStateId", request.DesignStateId),
                new SqlParameter("@StateChangedBy", request.StateChangedBy)
            );

            var designState = await GetDesignStateByIdAsync(request.DesignStateId);
            return designState ?? throw new InvalidOperationException("Failed to retrieve updated design state");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing template: {DesignStateId}", request.DesignStateId);
            throw;
        }
    }

    public async Task<IEnumerable<DesignStateDto>> GetDesignerDashboardAsync(int designerId)
    {
        try
        {
            var dashboard = await _context.Database.SqlQueryRaw<DesignStateDto>(
                "EXEC sp_GetDesignerDashboard @DesignerId",
                new SqlParameter("@DesignerId", designerId)
            ).ToListAsync();
            return dashboard;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting designer dashboard for designer: {DesignerId}", designerId);
            throw;
        }
    }

    public async Task<IEnumerable<DesignStateDto>> GetReviewerDashboardAsync(int reviewerId)
    {
        try
        {
            var dashboard = await _context.Database.SqlQueryRaw<DesignStateDto>(
                "EXEC sp_GetReviewerDashboard @ReviewerId",
                new SqlParameter("@ReviewerId", reviewerId)
            ).ToListAsync();
            return dashboard;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting reviewer dashboard for reviewer: {ReviewerId}", reviewerId);
            throw;
        }
    }

    public async Task<DashboardStatsDto> GetAdminDashboardAsync()
    {
        try
        {
            var stats = await _context.Database.SqlQueryRaw<DashboardStatsDto>(
                "EXEC sp_GetAdminDashboard"
            ).FirstOrDefaultAsync();
            return stats ?? new DashboardStatsDto();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting admin dashboard");
            throw;
        }
    }

    public async Task<DesignStateDto> SubmitForReviewAsync(SubmitForReviewRequest request)
    {
        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_SubmitForReview @DesignStateId, @ReviewerId, @Comments, @StateChangedBy, @IsDeleteRequest",
                new SqlParameter("@DesignStateId", request.DesignStateId),
                new SqlParameter("@ReviewerId", request.ReviewerId ?? (object)DBNull.Value),
                new SqlParameter("@Comments", request.Comments ?? (object)DBNull.Value),
                new SqlParameter("@StateChangedBy", request.StateChangedBy),
                new SqlParameter("@IsDeleteRequest", request.IsDeleteRequest)
            );

            var designState = await GetDesignStateByIdAsync(request.DesignStateId);
            return designState ?? throw new InvalidOperationException("Failed to retrieve updated design state");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting design state for review: {DesignStateId}", request.DesignStateId);
            throw;
        }

    }

    public async Task<DesignStateDto> AssignReviewerAsync(AssignReviewerRequest request)
    {
        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_AssignReviewer @DesignStateId, @ReviewerId, @AssignedBy, @Comments",
                new SqlParameter("@DesignStateId", request.DesignStateId),
                new SqlParameter("@ReviewerId", request.ReviewerId),
                new SqlParameter("@AssignedBy", request.AssignedBy),
                new SqlParameter("@Comments", request.Comments ?? (object)DBNull.Value)
            );

            var designState = await GetDesignStateByIdAsync(request.DesignStateId);
            return designState ?? throw new InvalidOperationException("Failed to retrieve updated design state");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning reviewer to design state: {DesignStateId}", request.DesignStateId);
            throw;
        }
    }

    public async Task<DesignStateDto> UnassignReviewerAsync(UnassignReviewerRequest request)
    {
        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_UnassignReviewer @DesignStateId, @UnassignedBy, @Comments",
                new SqlParameter("@DesignStateId", request.DesignStateId),
                new SqlParameter("@UnassignedBy", request.UnassignedBy),
                new SqlParameter("@Comments", request.Comments ?? (object)DBNull.Value)
            );

            var designState = await GetDesignStateByIdAsync(request.DesignStateId);
            return designState ?? throw new InvalidOperationException("Failed to retrieve updated design state");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unassigning reviewer from design state: {DesignStateId}", request.DesignStateId);
            throw;
        }
    }
}

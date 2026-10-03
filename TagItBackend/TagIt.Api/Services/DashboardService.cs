using TagIt.Api.Models;
using TagIt.Api.Providers;

namespace TagIt.Api.Services;

public class DashboardService : IDashboardService
{
    private readonly IDashboardProvider _dashboardProvider;
    private readonly ILogger<DashboardService> _logger;

    public DashboardService(IDashboardProvider dashboardProvider, ILogger<DashboardService> logger)
    {
        _dashboardProvider = dashboardProvider;
        _logger = logger;
    }

    public async Task<IEnumerable<DashboardTemplateDto>> GetTemplatesByLibraryAsync(string libraryType, int userId)
    {
        try
        {
            // Validate library type
            var validLibraryTypes = new[] { "public", "local", "submitted", "all-submissions", "assigned" };
            if (!validLibraryTypes.Contains(libraryType.ToLower()))
            {
                throw new ArgumentException($"Invalid library type: {libraryType}. Valid types are: {string.Join(", ", validLibraryTypes)}");
            }

            return await _dashboardProvider.GetTemplatesByLibraryAsync(libraryType, userId);
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
            return await _dashboardProvider.GetReviewersAsync();
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
            return await _dashboardProvider.GetDashboardStatsAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting dashboard statistics");
            throw;
        }
    }
}

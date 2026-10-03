using TagIt.Api.Models;

namespace TagIt.Api.Services;

public interface IDashboardService
{
    Task<IEnumerable<DashboardTemplateDto>> GetTemplatesByLibraryAsync(string libraryType, int userId);
    Task<IEnumerable<ReviewerDto>> GetReviewersAsync();
    Task<DashboardStatsDto> GetDashboardStatsAsync();
}

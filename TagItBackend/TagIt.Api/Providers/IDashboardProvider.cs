using TagIt.Api.Models;

namespace TagIt.Api.Providers;

public interface IDashboardProvider
{
    Task<IEnumerable<DashboardTemplateDto>> GetTemplatesByLibraryAsync(string libraryType, int userId);
    Task<IEnumerable<ReviewerDto>> GetReviewersAsync();
    Task<DashboardStatsDto> GetDashboardStatsAsync();
}

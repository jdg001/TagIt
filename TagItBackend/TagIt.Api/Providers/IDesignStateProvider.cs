using TagIt.Api.Models;

namespace TagIt.Api.Providers;

public interface IDesignStateProvider
{
    Task<IEnumerable<DesignStateDto>> GetAllDesignStatesAsync();
    Task<DesignStateDto?> GetDesignStateByIdAsync(int designStateId);
    Task<DesignStateDto> CreateDesignStateAsync(CreateDesignStateRequest request);
    Task<DesignStateDto> UpdateDesignStateAsync(int designStateId, UpdateDesignStateRequest request);
    Task<bool> DeleteDesignStateAsync(int designStateId);
    Task<DesignStateDto?> GetCurrentTemplateStateAsync(int templateId);
    Task<IEnumerable<DesignStateDto>> GetTemplateStatesAsync(int templateId);
    Task<DesignStateDto> SubmitForReviewAsync(SubmitForReviewRequest request);
    Task<DesignStateDto> ApproveTemplateAsync(ApproveTemplateRequest request);
    Task<DesignStateDto> RejectTemplateAsync(RejectTemplateRequest request);
    Task<DesignStateDto> PublishTemplateAsync(PublishTemplateRequest request);
    Task<DesignStateDto> AssignReviewerAsync(AssignReviewerRequest request);
    Task<DesignStateDto> UnassignReviewerAsync(UnassignReviewerRequest request);
    Task<IEnumerable<DesignStateDto>> GetDesignerDashboardAsync(int designerId);
    Task<IEnumerable<DesignStateDto>> GetReviewerDashboardAsync(int reviewerId);
    Task<DashboardStatsDto> GetAdminDashboardAsync();
}

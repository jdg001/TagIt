using TagIt.Api.Models;

namespace TagIt.Api.Services;

public interface IDesignStateService
{
    Task<IEnumerable<DesignStateDto>> GetAllDesignStatesAsync();
    Task<DesignStateDto?> GetDesignStateByIdAsync(int designStateId);
    Task<DesignStateDto> CreateDesignStateAsync(CreateDesignStateRequest request, int currentUserId);
    Task<DesignStateDto> UpdateDesignStateAsync(int designStateId, UpdateDesignStateRequest request, int currentUserId);
    Task<bool> DeleteDesignStateAsync(int designStateId, int currentUserId);
    Task<DesignStateDto?> GetCurrentTemplateStateAsync(int templateId);
    Task<IEnumerable<DesignStateDto>> GetTemplateStatesAsync(int templateId);
    Task<DesignStateDto> SubmitForReviewAsync(SubmitForReviewRequest request, int currentUserId);
    Task<DesignStateDto> ApproveTemplateAsync(ApproveTemplateRequest request, int currentUserId);
    Task<DesignStateDto> RejectTemplateAsync(RejectTemplateRequest request, int currentUserId);
    Task<DesignStateDto> RejectTemplateWithCommentsAsync(RejectTemplateRequest request, BulkCreateCommentsRequest commentsRequest, int currentUserId);
    Task<DesignStateDto> PublishTemplateAsync(PublishTemplateRequest request, int currentUserId);
    Task<DesignStateDto> AssignReviewerAsync(AssignReviewerRequest request, int currentUserId);
    Task<DesignStateDto> UnassignReviewerAsync(UnassignReviewerRequest request, int currentUserId);
    Task<IEnumerable<DesignStateDto>> GetDesignerDashboardAsync(int designerId);
    Task<IEnumerable<DesignStateDto>> GetReviewerDashboardAsync(int reviewerId);
    Task<DashboardStatsDto> GetAdminDashboardAsync();
    Task<bool> ValidateUserCanModifyDesignStateAsync(int userId, int designStateId, string action);
    Task<bool> ValidateWorkflowTransition(string currentState, string newState, int userId);
}

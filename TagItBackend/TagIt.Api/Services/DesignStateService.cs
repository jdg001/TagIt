using Microsoft.EntityFrameworkCore;
using TagIt.Api.Data;
using TagIt.Api.Models;
using TagIt.Api.Providers;

namespace TagIt.Api.Services;

public class DesignStateService : IDesignStateService
{
    private readonly IDesignStateProvider _designStateProvider;
    private readonly IRoleService _roleService;
    private readonly ICommentService _commentService;
    private readonly ILogger<DesignStateService> _logger;

    public DesignStateService(
        IDesignStateProvider designStateProvider, 
        IRoleService roleService,
        ICommentService commentService,
        ILogger<DesignStateService> logger)
    {
        _designStateProvider = designStateProvider;
        _roleService = roleService;
        _commentService = commentService;
        _logger = logger;
    }

    public async Task<IEnumerable<DesignStateDto>> GetAllDesignStatesAsync()
    {
        try
        {
            return await _designStateProvider.GetAllDesignStatesAsync();
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
            return await _designStateProvider.GetDesignStateByIdAsync(designStateId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting design state by ID: {DesignStateId}", designStateId);
            throw;
        }
    }

    public async Task<DesignStateDto> CreateDesignStateAsync(CreateDesignStateRequest request, int currentUserId)
    {
        try
        {
            // Validate that user is a designer
            if (!await _roleService.ValidateUserHasRoleAsync(currentUserId, "Designer"))
            {
                throw new UnauthorizedAccessException("Only designers can create design states");
            }

            // Validate that the designer is the one creating the state
            if (request.DesignerId != currentUserId)
            {
                throw new UnauthorizedAccessException("You can only create design states for yourself");
            }

            // Validate workflow transition
            //if (!await ValidateWorkflowTransitionAsync("", request.State, currentUserId))
            //{
            //    throw new InvalidOperationException($"Invalid initial state: {request.State}");
            //}

            return await _designStateProvider.CreateDesignStateAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating design state for template: {TemplateId}", request.TemplateId);
            throw;
        }
    }

    public async Task<DesignStateDto> UpdateDesignStateAsync(int designStateId, UpdateDesignStateRequest request, int currentUserId)
    {
        try
        {
            // Validate user can modify this design state
            if (!await ValidateUserCanModifyDesignStateAsync(currentUserId, designStateId, "update"))
            {
                throw new UnauthorizedAccessException("You don't have permission to modify this design state");
            }

            // Get current state to validate transition
            var currentState = await _designStateProvider.GetDesignStateByIdAsync(designStateId);
            if (currentState == null)
            {
                throw new ArgumentException($"Design state with ID {designStateId} not found");
            }

            // Validate workflow transition
            if (!await ValidateWorkflowTransition(currentState.State, request.NewState, currentUserId))
            {
                throw new InvalidOperationException($"Invalid state transition from '{currentState.State}' to '{request.NewState}'");
            }

            return await _designStateProvider.UpdateDesignStateAsync(designStateId, request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating design state: {DesignStateId}", designStateId);
            throw;
        }
    }

    public async Task<bool> DeleteDesignStateAsync(int designStateId, int currentUserId)
    {
        try
        {
            // Validate user can modify this design state
            if (!await ValidateUserCanModifyDesignStateAsync(currentUserId, designStateId, "delete"))
            {
                throw new UnauthorizedAccessException("You don't have permission to delete this design state");
            }

            return await _designStateProvider.DeleteDesignStateAsync(designStateId);
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
            return await _designStateProvider.GetCurrentTemplateStateAsync(templateId);
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
            return await _designStateProvider.GetTemplateStatesAsync(templateId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting template states for template: {TemplateId}", templateId);
            throw;
        }
    }

    public async Task<DesignStateDto> SubmitForReviewAsync(SubmitForReviewRequest request, int currentUserId)
    {
        try
        {
            // Validate user permissions based on request type
            if (request.IsDeleteRequest)
            {
                // For delete requests, allow Designers and Admins
                var isDesigner = await _roleService.ValidateUserHasRoleAsync(currentUserId, "Designer");
                var isAdmin = await _roleService.ValidateUserHasRoleAsync(currentUserId, "Admin");
                
                if (!isDesigner && !isAdmin)
                {
                    throw new UnauthorizedAccessException("Only designers and admins can submit delete requests");
                }
            }
            else
            {
                // For regular submissions, only designers can submit
                if (!await _roleService.ValidateUserHasRoleAsync(currentUserId, "Designer"))
                {
                    throw new UnauthorizedAccessException("Only designers can submit templates for review");
                }
            }

            // Validate that the design state exists
            var designState = await _designStateProvider.GetDesignStateByIdAsync(request.DesignStateId);
            if (designState == null)
            {
                throw new ArgumentException($"Design state with ID {request.DesignStateId} not found");
            }

            // For regular submissions, validate that the designer owns this design state
            // For delete requests, any Designer/Admin can request deletion of published templates
            if (!request.IsDeleteRequest && designState.DesignerId != currentUserId)
            {
                throw new UnauthorizedAccessException("You can only submit your own templates for review");
            }

            return await _designStateProvider.SubmitForReviewAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting for review: {DesignStateId}", request.DesignStateId);
            throw;
        }
    }

    public async Task<DesignStateDto> ApproveTemplateAsync(ApproveTemplateRequest request, int currentUserId)
    {
        try
        {
            // Validate that user is a reviewer
            if (!await _roleService.ValidateUserHasRoleAsync(currentUserId, "Reviewer"))
            {
                throw new UnauthorizedAccessException("Only reviewers can approve templates");
            }

            // Validate that the reviewer is assigned to this design state
            var designState = await _designStateProvider.GetDesignStateByIdAsync(request.DesignStateId);
            if (designState == null)
            {
                throw new ArgumentException($"Design state with ID {request.DesignStateId} not found");
            }

            if (designState.ReviewerId != currentUserId)
            {
                throw new UnauthorizedAccessException("You can only approve templates assigned to you");
            }

            // [CHANGE] Validate that there are no unresolved comments using the new comment system
            var hasUnresolvedComments = await _commentService.HasUnresolvedCommentsAsync(request.DesignStateId);
            if (hasUnresolvedComments)
            {
                throw new InvalidOperationException("Cannot approve template with unresolved comments. Please resolve all comments before approval.");
            }

            return await _designStateProvider.ApproveTemplateAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error approving template: {DesignStateId}", request.DesignStateId);
            throw;
        }
    }

    public async Task<DesignStateDto> RejectTemplateAsync(RejectTemplateRequest request, int currentUserId)
    {
        try
        {
            // Validate that user is a reviewer
            if (!await _roleService.ValidateUserHasRoleAsync(currentUserId, "Reviewer"))
            {
                throw new UnauthorizedAccessException("Only reviewers can reject templates");
            }

            // Validate that the reviewer is assigned to this design state
            var designState = await _designStateProvider.GetDesignStateByIdAsync(request.DesignStateId);
            if (designState == null)
            {
                throw new ArgumentException($"Design state with ID {request.DesignStateId} not found");
            }

            if (designState.ReviewerId != currentUserId)
            {
                throw new UnauthorizedAccessException("You can only reject templates assigned to you");
            }

            // Comments are required for rejection
            if (string.IsNullOrWhiteSpace(request.Comments))
            {
                throw new ArgumentException("Comments are required when rejecting a template");
            }

            return await _designStateProvider.RejectTemplateAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rejecting template: {DesignStateId}", request.DesignStateId);
            throw;
        }
    }

    // [CHANGE] New method for rejecting templates with canvas comments
    public async Task<DesignStateDto> RejectTemplateWithCommentsAsync(RejectTemplateRequest request, BulkCreateCommentsRequest commentsRequest, int currentUserId)
    {
        try
        {
            // Validate that user is a reviewer
            if (!await _roleService.ValidateUserHasRoleAsync(currentUserId, "Reviewer"))
            {
                throw new UnauthorizedAccessException("Only reviewers can reject templates");
            }

            // Validate that the reviewer is assigned to this design state
            var designState = await _designStateProvider.GetDesignStateByIdAsync(request.DesignStateId);
            if (designState == null)
            {
                throw new ArgumentException($"Design state with ID {request.DesignStateId} not found");
            }

            if (designState.ReviewerId != currentUserId)
            {
                throw new UnauthorizedAccessException("You can only reject templates assigned to you");
            }

            // Create comments first
            if (commentsRequest.Comments.Any())
            {
                await _commentService.BulkCreateCommentsAsync(commentsRequest, currentUserId);
            }

            // Then reject the template
            return await _designStateProvider.RejectTemplateAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rejecting template with comments: {DesignStateId}", request.DesignStateId);
            throw;
        }
    }

    public async Task<DesignStateDto> PublishTemplateAsync(PublishTemplateRequest request, int currentUserId)
    {
        try
        {
            // Validate that user is a reviewer or admin
            var isReviewer = await _roleService.ValidateUserHasRoleAsync(currentUserId, "Reviewer");
            var isAdmin = await _roleService.ValidateUserHasRoleAsync(currentUserId, "Admin");
            
            if (!isReviewer && !isAdmin)
            {
                throw new UnauthorizedAccessException("Only reviewers or administrators can publish templates");
            }

            // Validate that the template is approved
            var designState = await _designStateProvider.GetDesignStateByIdAsync(request.DesignStateId);
            if (designState == null)
            {
                throw new ArgumentException($"Design state with ID {request.DesignStateId} not found");
            }

            if (designState.State != "Approved")
            {
                throw new InvalidOperationException("Only approved templates can be published");
            }

            return await _designStateProvider.PublishTemplateAsync(request);
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
            return await _designStateProvider.GetDesignerDashboardAsync(designerId);
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
            return await _designStateProvider.GetReviewerDashboardAsync(reviewerId);
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
            return await _designStateProvider.GetAdminDashboardAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting admin dashboard");
            throw;
        }
    }

    public async Task<bool> ValidateUserCanModifyDesignStateAsync(int userId, int designStateId, string action)
    {
        try
        {
            var designState = await _designStateProvider.GetDesignStateByIdAsync(designStateId);
            if (designState == null)
                return false;

            // Check if user is the designer
            if (designState.DesignerId == userId)
                return true;

            // Check if user is the assigned reviewer
            if (designState.ReviewerId == userId)
                return true;

            // Check if user is admin
            if (await _roleService.ValidateUserHasRoleAsync(userId, "Reviewer"))
                return true;

            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating user permission for design state: UserId={UserId}, DesignStateId={DesignStateId}, Action={Action}", 
                userId, designStateId, action);
            return false;
        }
    }

    public async Task<bool> ValidateWorkflowTransition(string currentState, string newState, int userId)
    {
        try
        {
            // Define valid workflow transitions
            var validTransitions = new Dictionary<string, List<string>>
            {
                { "", new List<string> { "Draft" } }, // Initial state
                { "Draft", new List<string> { "UnderReview", "Archived" } },
                { "UnderReview", new List<string> { "Approved", "Rejected", "Draft" } },
                { "Approved", new List<string> { "Published", "Draft" } },
                { "Rejected", new List<string> { "Draft", "UnderReview" } },
                { "Published", new List<string> { "Archived" } },
                { "Archived", new List<string> { "Draft" } }
            };

            if (!validTransitions.ContainsKey(currentState))
                return false;

            return await Task.FromResult(validTransitions[currentState].Contains(newState));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating workflow transition: CurrentState={CurrentState}, NewState={NewState}, UserId={UserId}",
                currentState, newState, userId);
            return false;
        }
    }

    public async Task<DesignStateDto> AssignReviewerAsync(AssignReviewerRequest request, int currentUserId)
    {
        try
        {
            // Validate that the user can assign reviewers
            if (!await ValidateUserCanModifyDesignStateAsync(currentUserId, request.DesignStateId, "assign"))
            {
                throw new UnauthorizedAccessException("You don't have permission to assign reviewers to this design state");
            }

            return await _designStateProvider.AssignReviewerAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning reviewer to design state: {DesignStateId}", request.DesignStateId);
            throw;
        }
    }

    public async Task<DesignStateDto> UnassignReviewerAsync(UnassignReviewerRequest request, int currentUserId)
    {
        try
        {
            // Validate that the user can unassign reviewers
            if (!await ValidateUserCanModifyDesignStateAsync(currentUserId, request.DesignStateId, "unassign"))
            {
                throw new UnauthorizedAccessException("You don't have permission to unassign reviewers from this design state");
            }

            return await _designStateProvider.UnassignReviewerAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unassigning reviewer from design state: {DesignStateId}", request.DesignStateId);
            throw;
        }
    }
}

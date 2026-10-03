using TagIt.Api.Models;
using TagIt.Api.Providers;

namespace TagIt.Api.Services;

public class CommentService : ICommentService
{
    private readonly ICommentProvider _commentProvider;
    private readonly IRoleService _roleService;
    private readonly ILogger<CommentService> _logger;

    public CommentService(
        ICommentProvider commentProvider,
        IRoleService roleService,
        ILogger<CommentService> logger)
    {
        _commentProvider = commentProvider;
        _roleService = roleService;
        _logger = logger;
    }

    public async Task<IEnumerable<CommentDto>> GetCommentsByDesignStateIdAsync(int designStateId, int currentUserId)
    {
        try
        {
            // Validate user has access to this design state
            // This would need to be implemented based on your access control logic
            // For now, we'll allow access if user is designer, reviewer, or admin
            
            return await _commentProvider.GetCommentsByDesignStateIdAsync(designStateId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting comments for design state: {DesignStateId}", designStateId);
            throw;
        }
    }

    public async Task<CommentDto?> GetCommentByIdAsync(int commentId, int currentUserId)
    {
        try
        {
            return await _commentProvider.GetCommentByIdAsync(commentId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting comment: {CommentId}", commentId);
            throw;
        }
    }

    public async Task<CommentDto> CreateCommentAsync(CreateCommentRequest request, int currentUserId)
    {
        try
        {
            // Validate that user is a reviewer
            if (!await _roleService.ValidateUserHasRoleAsync(currentUserId, "Reviewer"))
            {
                throw new UnauthorizedAccessException("Only reviewers can create comments");
            }

            // Ensure the request is from the current user
            request.CreatedBy = currentUserId;

            return await _commentProvider.CreateCommentAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating comment for design state: {DesignStateId}", request.DesignStateId);
            throw;
        }
    }

    public async Task<CommentDto> UpdateCommentAsync(UpdateCommentRequest request, int currentUserId)
    {
        try
        {
            // Validate that user is a reviewer or admin
            var isReviewer = await _roleService.ValidateUserHasRoleAsync(currentUserId, "Reviewer");
            var isAdmin = await _roleService.ValidateUserHasRoleAsync(currentUserId, "Admin");
            
            if (!isReviewer && !isAdmin)
            {
                throw new UnauthorizedAccessException("Only reviewers or administrators can update comments");
            }

            // Ensure the request is from the current user
            request.UpdatedBy = currentUserId;

            return await _commentProvider.UpdateCommentAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating comment: {CommentId}", request.CommentId);
            throw;
        }
    }

    public async Task<bool> ResolveCommentAsync(ResolveCommentRequest request, int currentUserId)
    {
        try
        {
            // Validate that user is a designer or admin
            //var isDesigner = await _roleService.ValidateUserHasRoleAsync(currentUserId, "Designer");
            
            //if (!isDesigner)
            //{
            //    throw new UnauthorizedAccessException("Only designers or administrators can resolve comments");
            //}

            // Ensure the request is from the current user
            request.ResolvedBy = currentUserId;

            return await _commentProvider.ResolveCommentAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resolving comment: {CommentId}", request.CommentId);
            throw;
        }
    }

    public async Task<bool> DeleteCommentAsync(DeleteCommentRequest request, int currentUserId)
    {
        try
        {
            // Validate that user is a reviewer or admin
            var isReviewer = await _roleService.ValidateUserHasRoleAsync(currentUserId, "Reviewer");
            var isAdmin = await _roleService.ValidateUserHasRoleAsync(currentUserId, "Admin");
            
            if (!isReviewer && !isAdmin)
            {
                throw new UnauthorizedAccessException("Only reviewers or administrators can delete comments");
            }

            return await _commentProvider.DeleteCommentAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting comment: {CommentId}", request.CommentId);
            throw;
        }
    }

    public async Task<IEnumerable<CommentDto>> BulkCreateCommentsAsync(BulkCreateCommentsRequest request, int currentUserId)
    {
        try
        {
            // Validate that user is a reviewer
            if (!await _roleService.ValidateUserHasRoleAsync(currentUserId, "Reviewer"))
            {
                throw new UnauthorizedAccessException("Only reviewers can create comments");
            }

            // Ensure the request is from the current user
            request.CreatedBy = currentUserId;

            return await _commentProvider.BulkCreateCommentsAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error bulk creating comments for design state: {DesignStateId}", request.DesignStateId);
            throw;
        }
    }

    public async Task<bool> HasUnresolvedCommentsAsync(int designStateId)
    {
        try
        {
            return await _commentProvider.HasUnresolvedCommentsAsync(designStateId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking unresolved comments for design state: {DesignStateId}", designStateId);
            throw;
        }
    }

    public async Task<int> GetUnresolvedCommentCountAsync(int designStateId)
    {
        try
        {
            return await _commentProvider.GetUnresolvedCommentCountAsync(designStateId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting unresolved comment count for design state: {DesignStateId}", designStateId);
            throw;
        }
    }
}

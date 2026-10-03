using Microsoft.EntityFrameworkCore;
using TagIt.Api.Data;
using TagIt.Api.Models;

namespace TagIt.Api.Providers;

public class CommentProvider : ICommentProvider
{
    private readonly AppDb _context;
    private readonly ILogger<CommentProvider> _logger;

    public CommentProvider(AppDb context, ILogger<CommentProvider> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<IEnumerable<CommentDto>> GetCommentsByDesignStateIdAsync(int designStateId)
    {
        try
        {
            var comments = await _context.Comments
                .Include(c => c.CreatedByUser)
                .Include(c => c.UpdatedByUser)
                .Include(c => c.ResolvedByUser)
                .Where(c => c.DesignStateId == designStateId)
                .Select(c => new CommentDto
                {
                    CommentId = c.CommentId,
                    DesignStateId = c.DesignStateId,
                    CommentText = c.CommentText,
                    PositionX = c.PositionX,
                    PositionY = c.PositionY,
                    PaperLayoutLeft = c.PaperLayoutLeft,    // [NEW] Paper layout context
                    PaperLayoutTop = c.PaperLayoutTop,      // [NEW] Paper layout context
                    PaperLayoutWidth = c.PaperLayoutWidth,  // [NEW] Paper layout context
                    PaperLayoutHeight = c.PaperLayoutHeight, // [NEW] Paper layout context
                    CreatedBy = c.CreatedBy,
                    CreatedByName = c.CreatedByUser.Email,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt,
                    UpdatedBy = c.UpdatedBy,
                    UpdatedByName = c.UpdatedByUser != null ? c.UpdatedByUser.Email : null,
                    IsResolved = c.IsResolved,
                    ResolvedAt = c.ResolvedAt,
                    ResolvedBy = c.ResolvedBy,
                    ResolvedByName = c.ResolvedByUser != null ? c.ResolvedByUser.Email : null,
                    ResponseText = c.ResponseText,
                })
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();

            return comments;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting comments for design state: {DesignStateId}", designStateId);
            throw;
        }
    }

    public async Task<CommentDto?> GetCommentByIdAsync(int commentId)
    {
        try
        {
            var comment = await _context.Comments
                .Include(c => c.CreatedByUser)
                .Include(c => c.UpdatedByUser)
                .Include(c => c.ResolvedByUser)
                .Where(c => c.CommentId == commentId)
                .Select(c => new CommentDto
                {
                    CommentId = c.CommentId,
                    DesignStateId = c.DesignStateId,
                    CommentText = c.CommentText,
                    PositionX = c.PositionX,
                    PositionY = c.PositionY,
                    PaperLayoutLeft = c.PaperLayoutLeft,    // [NEW] Paper layout context
                    PaperLayoutTop = c.PaperLayoutTop,      // [NEW] Paper layout context
                    PaperLayoutWidth = c.PaperLayoutWidth,  // [NEW] Paper layout context
                    PaperLayoutHeight = c.PaperLayoutHeight, // [NEW] Paper layout context
                    CreatedBy = c.CreatedBy,
                    CreatedByName = c.CreatedByUser.Email,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt,
                    UpdatedBy = c.UpdatedBy,
                    UpdatedByName = c.UpdatedByUser != null ? c.UpdatedByUser.Email : null,
                    IsResolved = c.IsResolved,
                    ResolvedAt = c.ResolvedAt,
                    ResolvedBy = c.ResolvedBy,
                    ResolvedByName = c.ResolvedByUser != null ? c.ResolvedByUser.Email : null,
                    ResponseText = c.ResponseText,
                })
                .FirstOrDefaultAsync();

            return comment;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting comment: {CommentId}", commentId);
            throw;
        }
    }

    public async Task<CommentDto> CreateCommentAsync(CreateCommentRequest request)
    {
        try
        {
            var comment = new Comment
            {
                DesignStateId = request.DesignStateId,
                CommentText = request.CommentText,
                PositionX = request.PositionX,
                PositionY = request.PositionY,
                PaperLayoutLeft = request.PaperLayoutLeft,    // [NEW] Paper layout context
                PaperLayoutTop = request.PaperLayoutTop,      // [NEW] Paper layout context
                PaperLayoutWidth = request.PaperLayoutWidth,  // [NEW] Paper layout context
                PaperLayoutHeight = request.PaperLayoutHeight, // [NEW] Paper layout context
                CreatedBy = request.CreatedBy,
                CreatedAt = DateTime.UtcNow
            };

            _context.Comments.Add(comment);
            await _context.SaveChangesAsync();

            // Return the created comment with user details
            return await GetCommentByIdAsync(comment.CommentId) ?? 
                   throw new InvalidOperationException("Failed to retrieve created comment");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating comment for design state: {DesignStateId}", request.DesignStateId);
            throw;
        }
    }

    public async Task<CommentDto> UpdateCommentAsync(UpdateCommentRequest request)
    {
        try
        {
            var comment = await _context.Comments
                .FirstOrDefaultAsync(c => c.CommentId == request.CommentId);

            if (comment == null)
            {
                throw new ArgumentException($"Comment with ID {request.CommentId} not found");
            }

            comment.CommentText = request.CommentText;
            comment.PositionX = request.PositionX;
            comment.PositionY = request.PositionY;
            comment.PaperLayoutLeft = request.PaperLayoutLeft;    // [NEW] Paper layout context
            comment.PaperLayoutTop = request.PaperLayoutTop;      // [NEW] Paper layout context
            comment.PaperLayoutWidth = request.PaperLayoutWidth;  // [NEW] Paper layout context
            comment.PaperLayoutHeight = request.PaperLayoutHeight; // [NEW] Paper layout context
            comment.UpdatedBy = request.UpdatedBy;
            comment.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return await GetCommentByIdAsync(comment.CommentId) ?? 
                   throw new InvalidOperationException("Failed to retrieve updated comment");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating comment: {CommentId}", request.CommentId);
            throw;
        }
    }


    public async Task<bool> DeleteCommentAsync(DeleteCommentRequest request)
    {
        try
        {
            var comment = await _context.Comments
                .FirstOrDefaultAsync(c => c.CommentId == request.CommentId);

            if (comment == null)
            {
                return false;
            }

            // Hard delete - permanently remove from database
            _context.Comments.Remove(comment);
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting comment: {CommentId}", request.CommentId);
            throw;
        }
    }

    public async Task<IEnumerable<CommentDto>> BulkCreateCommentsAsync(BulkCreateCommentsRequest request)
    {
        try
        {
            var comments = request.Comments.Select(c => new Comment
            {
                DesignStateId = request.DesignStateId,
                CommentText = c.CommentText,
                PositionX = c.PositionX,
                PositionY = c.PositionY,
                PaperLayoutLeft = request.PaperLayoutLeft,    // [NEW] Paper layout context
                PaperLayoutTop = request.PaperLayoutTop,      // [NEW] Paper layout context
                PaperLayoutWidth = request.PaperLayoutWidth,  // [NEW] Paper layout context
                PaperLayoutHeight = request.PaperLayoutHeight, // [NEW] Paper layout context
                CreatedBy = request.CreatedBy,
                CreatedAt = DateTime.UtcNow
            }).ToList();

            _context.Comments.AddRange(comments);
            await _context.SaveChangesAsync();

            // Return all created comments
            return await GetCommentsByDesignStateIdAsync(request.DesignStateId);
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
            return await _context.Comments
                .AnyAsync(c => c.DesignStateId == designStateId && !c.IsResolved);
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
            return await _context.Comments
                .CountAsync(c => c.DesignStateId == designStateId && !c.IsResolved);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting unresolved comment count for design state: {DesignStateId}", designStateId);
            throw;
        }
    }

    public async Task<bool> ResolveCommentAsync(ResolveCommentRequest request)
    {
        try
        {
            var comment = await _context.Comments
                .FirstOrDefaultAsync(c => c.CommentId == request.CommentId);

            if (comment == null)
            {
                return false;
            }

            // Update comment to resolved status
            comment.IsResolved = true;
            comment.ResolvedBy = request.ResolvedBy;
            comment.ResolvedAt = DateTime.UtcNow;
            comment.ResponseText = request.ResponseText;

            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resolving comment: {CommentId}", request.CommentId);
            throw;
        }
    }
}

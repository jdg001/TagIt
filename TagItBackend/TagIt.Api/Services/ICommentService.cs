using TagIt.Api.Models;

namespace TagIt.Api.Services;

public interface ICommentService
{
    Task<IEnumerable<CommentDto>> GetCommentsByDesignStateIdAsync(int designStateId, int currentUserId);
    Task<CommentDto?> GetCommentByIdAsync(int commentId, int currentUserId);
    Task<CommentDto> CreateCommentAsync(CreateCommentRequest request, int currentUserId);
    Task<CommentDto> UpdateCommentAsync(UpdateCommentRequest request, int currentUserId);
    Task<bool> ResolveCommentAsync(ResolveCommentRequest request, int currentUserId);
    Task<bool> DeleteCommentAsync(DeleteCommentRequest request, int currentUserId);
    Task<IEnumerable<CommentDto>> BulkCreateCommentsAsync(BulkCreateCommentsRequest request, int currentUserId);
    Task<bool> HasUnresolvedCommentsAsync(int designStateId);
    Task<int> GetUnresolvedCommentCountAsync(int designStateId);
}

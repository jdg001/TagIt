using TagIt.Api.Models;

namespace TagIt.Api.Providers;

public interface ICommentProvider
{
    Task<IEnumerable<CommentDto>> GetCommentsByDesignStateIdAsync(int designStateId);
    Task<CommentDto?> GetCommentByIdAsync(int commentId);
    Task<CommentDto> CreateCommentAsync(CreateCommentRequest request);
    Task<CommentDto> UpdateCommentAsync(UpdateCommentRequest request);
    Task<bool> ResolveCommentAsync(ResolveCommentRequest request);
    Task<bool> DeleteCommentAsync(DeleteCommentRequest request);
    Task<IEnumerable<CommentDto>> BulkCreateCommentsAsync(BulkCreateCommentsRequest request);
    Task<bool> HasUnresolvedCommentsAsync(int designStateId);
    Task<int> GetUnresolvedCommentCountAsync(int designStateId);
}

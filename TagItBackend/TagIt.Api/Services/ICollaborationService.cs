using TagIt.Api.Models;

namespace TagIt.Api.Services;

public interface ICollaborationService
{
    // Session Management
    Task<JoinSessionResponse> JoinSessionAsync(string connectionId, int userId, string userName, string userEmail, int templateId, string? existingSessionId = null);
    Task<CollaborationUser?> LeaveSessionAsync(string connectionId, int userId, string sessionId);
    Task RemoveUserFromAllSessionsAsync(string connectionId, int userId);
    Task<string?> GetSessionIdByConnectionIdAsync(string connectionId);
    
    // Canvas State Management
    Task<CanvasState?> GetCanvasStateAsync(string sessionId);
    Task UpdateCanvasStateAsync(string sessionId, List<object> elements);
    Task<CanvasElementUpdate?> ProcessCanvasUpdateAsync(string sessionId, int userId, CanvasElementUpdate update);
    
    // User Presence Management
    Task<CollaborationUser?> UpdateUserCursorAsync(string connectionId, int userId, string sessionId, CursorPosition cursorPosition);
    Task<List<CollaborationUser>> GetSessionUsersAsync(string sessionId);
    
    // Session Cleanup
    Task CleanupInactiveSessionsAsync();
    Task<CollaborationSession?> GetSessionAsync(string sessionId);
    Task<CollaborationSession?> GetSessionByTemplateIdAsync(int templateId);
    Task<List<CollaborationSession>> GetActiveSessionsAsync();
}

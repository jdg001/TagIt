using TagIt.Api.Models;
using TagIt.Api.Data;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Text.Json;

namespace TagIt.Api.Services;

public class CollaborationService : ICollaborationService
{
    private readonly AppDb _context;
    private readonly ILogger<CollaborationService> _logger;
    
    // In-memory storage for active collaboration sessions
    private static readonly ConcurrentDictionary<string, CollaborationSession> _activeSessions = new();
    private static readonly ConcurrentDictionary<string, string> _connectionToSession = new(); // connectionId -> sessionId
    private static readonly ConcurrentDictionary<string, int> _connectionToUser = new(); // connectionId -> userId
    
    // User colors for cursor display
    private static readonly string[] _userColors = {
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
        "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
    };
    private static int _colorIndex = 0;

    public CollaborationService(AppDb context, ILogger<CollaborationService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<JoinSessionResponse> JoinSessionAsync(string connectionId, int userId, string userName, string userEmail, int templateId, string? existingSessionId = null)
    {
        try
        {
            // Check if user is already in a session
            if (_connectionToSession.ContainsKey(connectionId))
            {
                return new JoinSessionResponse
                {
                    Success = false,
                    ErrorMessage = "User is already in a collaboration session"
                };
            }

            CollaborationSession session;

            // First, look for existing session for this specific template
            var existingTemplateSession = _activeSessions.Values
                .FirstOrDefault(s => s.TemplateId == templateId && s.IsActive);

            if (!string.IsNullOrEmpty(existingSessionId) && _activeSessions.ContainsKey(existingSessionId))
            {
                // Join specific existing session
                session = _activeSessions[existingSessionId];
                
                if (!session.IsActive)
                {
                    return new JoinSessionResponse
                    {
                        Success = false,
                        ErrorMessage = "Session is no longer available"
                    };
                }
                
                _logger.LogInformation("User {UserId} joining specific session {SessionId} for template {TemplateId}", 
                    userId, existingSessionId, templateId);
            }
            else if (existingTemplateSession != null)
            {
                // Join existing session for this template
                session = existingTemplateSession;
                _logger.LogInformation("User {UserId} joining existing session {SessionId} for template {TemplateId}", 
                    userId, session.SessionId, templateId);
            }
            else
            {
                // Create new session for this template
                session = new CollaborationSession
                {
                    SessionId = Guid.NewGuid().ToString(),
                    TemplateId = templateId,
                    TemplateName = await GetTemplateNameAsync(templateId),
                    CreatedAt = DateTime.UtcNow,
                    LastActivity = DateTime.UtcNow,
                    IsActive = true
                };
                
                // Add the new session to active sessions immediately
                _activeSessions[session.SessionId] = session;
                
                _logger.LogInformation("User {UserId} creating new session {SessionId} for template {TemplateId}", 
                    userId, session.SessionId, templateId);
            }

            // Assign color to user
            var userColor = GetNextUserColor();

            var collaborationUser = new CollaborationUser
            {
                ConnectionId = connectionId,
                UserId = userId,
                UserName = userName,
                UserEmail = userEmail,
                Color = userColor,
                CurrentTemplateId = templateId,
                CurrentTemplateName = await GetTemplateNameAsync(templateId),
                JoinedAt = DateTime.UtcNow,
                LastSeen = DateTime.UtcNow,
                IsActive = true
            };

            // Add user to session
            session.ConnectedUsers.Add(collaborationUser);
            session.LastActivity = DateTime.UtcNow;

            // Update active templates tracking
            await UpdateActiveTemplatesAsync(session, templateId, userId);

            // Update tracking dictionaries
            _connectionToSession[connectionId] = session.SessionId;
            _connectionToUser[connectionId] = userId;

            // Load current canvas state if this is a new session or if session doesn't have canvas state yet
            CanvasState? canvasState = null;
            if (session.CanvasState == null) // Session doesn't have canvas state yet
            {
                canvasState = await LoadCanvasStateFromDatabaseAsync(templateId);
                if (canvasState != null)
                {
                    canvasState.SessionId = session.SessionId;
                    session.CanvasState = canvasState; // Store in session for future users
                }
            }
            else
            {
                // Session already has canvas state, use it
                canvasState = session.CanvasState;
            }

            _logger.LogInformation("User {UserId} joined session {SessionId} for template {TemplateId}", 
                userId, session.SessionId, templateId);

            return new JoinSessionResponse
            {
                Success = true,
                SessionId = session.SessionId,
                ConnectedUsers = session.ConnectedUsers.ToList(),
                CurrentCanvasState = canvasState
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error joining session for user {UserId}", userId);
            return new JoinSessionResponse
            {
                Success = false,
                ErrorMessage = "An error occurred while joining the session"
            };
        }
    }

    public async Task<CollaborationUser?> LeaveSessionAsync(string connectionId, int userId, string sessionId)
    {
        try
        {
            if (!_activeSessions.TryGetValue(sessionId, out var session))
            {
                _logger.LogWarning("Session {SessionId} not found when user {UserId} tried to leave", sessionId, userId);
                return null;
            }

            var user = session.ConnectedUsers.FirstOrDefault(u => u.ConnectionId == connectionId && u.UserId == userId);
            if (user == null)
            {
                _logger.LogWarning("User {UserId} not found in session {SessionId}", userId, sessionId);
                return null;
            }

            // Remove user from session
            session.ConnectedUsers.Remove(user);
            session.LastActivity = DateTime.UtcNow;

            // Remove from tracking dictionaries
            _connectionToSession.TryRemove(connectionId, out _);
            _connectionToUser.TryRemove(connectionId, out _);

            // If no users left, mark session as inactive
            if (session.ConnectedUsers.Count == 0)
            {
                session.IsActive = false;
                _activeSessions.TryRemove(sessionId, out _);
                _logger.LogInformation("Session {SessionId} ended - no users remaining", sessionId);
            }
            else
            {
                _activeSessions[sessionId] = session;
            }

            _logger.LogInformation("User {UserId} left session {SessionId}", userId, sessionId);
            return user;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error leaving session for user {UserId}", userId);
            return null;
        }
    }

    public async Task RemoveUserFromAllSessionsAsync(string connectionId, int userId)
    {
        try
        {
            if (_connectionToSession.TryGetValue(connectionId, out var sessionId))
            {
                await LeaveSessionAsync(connectionId, userId, sessionId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing user {UserId} from all sessions", userId);
        }
    }

    public async Task<string?> GetSessionIdByConnectionIdAsync(string connectionId)
    {
        return _connectionToSession.TryGetValue(connectionId, out var sessionId) ? sessionId : null;
    }

    public async Task<CanvasState?> GetCanvasStateAsync(string sessionId)
    {
        if (_activeSessions.TryGetValue(sessionId, out var session))
        {
            // Return the stored canvas state if available
            if (session.CanvasState != null)
            {
                return session.CanvasState;
            }
            
            // Return null for new sessions without canvas state
            // This prevents clearing existing canvas elements on the frontend
            return null;
        }
        return null;
    }

    public async Task UpdateCanvasStateAsync(string sessionId, List<object> elements)
    {
        if (_activeSessions.TryGetValue(sessionId, out var session))
        {
            session.LastActivity = DateTime.UtcNow;
            // In a real implementation, you might want to store the canvas state
        }
    }

    public async Task<CanvasElementUpdate?> ProcessCanvasUpdateAsync(string sessionId, int userId, CanvasElementUpdate update)
    {
        try
        {
            if (!_activeSessions.TryGetValue(sessionId, out var session))
            {
                _logger.LogWarning("Session {SessionId} not found for canvas update", sessionId);
                return null;
            }

            // Update session activity
            session.LastActivity = DateTime.UtcNow;

            // Handle different update types
            switch (update.UpdateType)
            {
                   case "canvas_state_update":
                       // For canvas state updates, store the entire state
                       var elements = update.ElementData as List<object> ?? new List<object>();
                       
                       // Check if this is an optimized update with images
                       var hasImages = update.GetType().GetProperty("HasImages")?.GetValue(update) as bool? ?? false;
                       
                       // Extract paper layout from the update if present
                       PaperLayout? paperLayout = null;
                       var paperLayoutProperty = update.GetType().GetProperty("PaperLayout");
                       if (paperLayoutProperty?.GetValue(update) != null)
                       {
                           var paperLayoutData = paperLayoutProperty.GetValue(update);
                           if (paperLayoutData != null)
                           {
                               // Convert the paper layout data to our PaperLayout model
                               var paperLayoutType = paperLayoutData.GetType();
                               paperLayout = new PaperLayout
                               {
                                   Left = Convert.ToDouble(paperLayoutType.GetProperty("Left")?.GetValue(paperLayoutData) ?? 0),
                                   Top = Convert.ToDouble(paperLayoutType.GetProperty("Top")?.GetValue(paperLayoutData) ?? 0),
                                   Width = Convert.ToDouble(paperLayoutType.GetProperty("Width")?.GetValue(paperLayoutData) ?? 0),
                                   Height = Convert.ToDouble(paperLayoutType.GetProperty("Height")?.GetValue(paperLayoutData) ?? 0)
                               };
                           }
                       }
                       
                       if (hasImages)
                       {
                           _logger.LogInformation("Canvas state updated with images for session {SessionId} by user {UserId} - using optimized payload", sessionId, userId);
                       }
                       else
                       {
                           _logger.LogInformation("Canvas state updated for session {SessionId} by user {UserId}", sessionId, userId);
                       }
                       
                       session.CanvasState = new CanvasState
                       {
                           SessionId = sessionId,
                           Elements = elements,
                           LastUpdated = DateTime.UtcNow,
                           LastUpdatedBy = userId,
                           Version = (session.CanvasState?.Version ?? 0) + 1,
                           PaperLayout = paperLayout
                       };
                       break;
                
                case "element_add":
                case "element_update":
                case "element_delete":
                case "element_move":
                    // Handle individual element operations
                    _logger.LogDebug("Element operation {UpdateType} for element {ElementId} in session {SessionId}", 
                        update.UpdateType, update.ElementId, sessionId);
                    break;
                
                case "paper_layout_update":
                case "paper_layout_resize":
                    // Handle paper layout operations
                    _logger.LogDebug("Paper layout operation {UpdateType} in session {SessionId} by user {UserId}", 
                        update.UpdateType, sessionId, userId);
                    break;
            }

            // Add timestamp and operation ID if not present
            if (update.Timestamp == default)
            {
                update.Timestamp = DateTime.UtcNow;
            }

            if (string.IsNullOrEmpty(update.OperationId))
            {
                update.OperationId = Guid.NewGuid().ToString();
            }

            _logger.LogDebug("Processed canvas update for session {SessionId}: {UpdateType} on element {ElementId}", 
                sessionId, update.UpdateType, update.ElementId);

            return update;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing canvas update for session {SessionId}", sessionId);
            return null;
        }
    }

    public async Task<CollaborationUser?> UpdateUserCursorAsync(string connectionId, int userId, string sessionId, CursorPosition cursorPosition)
    {
        try
        {
            if (!_activeSessions.TryGetValue(sessionId, out var session))
            {
                return null;
            }

            var user = session.ConnectedUsers.FirstOrDefault(u => u.ConnectionId == connectionId && u.UserId == userId);
            if (user == null)
            {
                return null;
            }

            user.CursorPosition = cursorPosition;
            user.LastSeen = DateTime.UtcNow;
            session.LastActivity = DateTime.UtcNow;

            _activeSessions[sessionId] = session;
            return user;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating cursor for user {UserId}", userId);
            return null;
        }
    }

    public async Task<List<CollaborationUser>> GetSessionUsersAsync(string sessionId)
    {
        if (_activeSessions.TryGetValue(sessionId, out var session))
        {
            return session.ConnectedUsers.ToList();
        }
        return new List<CollaborationUser>();
    }

    public async Task CleanupInactiveSessionsAsync()
    {
        try
        {
            var cutoffTime = DateTime.UtcNow.AddMinutes(-30); // Sessions inactive for 30 minutes
            var sessionsToRemove = new List<string>();

            foreach (var kvp in _activeSessions)
            {
                if (!kvp.Value.IsActive || kvp.Value.LastActivity < cutoffTime)
                {
                    sessionsToRemove.Add(kvp.Key);
                }
            }

            foreach (var sessionId in sessionsToRemove)
            {
                if (_activeSessions.TryRemove(sessionId, out var session))
                {
                    // Remove all connections for this session
                    foreach (var user in session.ConnectedUsers)
                    {
                        _connectionToSession.TryRemove(user.ConnectionId, out _);
                        _connectionToUser.TryRemove(user.ConnectionId, out _);
                    }
                    _logger.LogInformation("Cleaned up inactive session {SessionId}", sessionId);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cleaning up inactive sessions");
        }
    }

    public async Task<CollaborationSession?> GetSessionAsync(string sessionId)
    {
        return _activeSessions.TryGetValue(sessionId, out var session) ? session : null;
    }

    public async Task<CollaborationSession?> GetSessionByTemplateIdAsync(int templateId)
    {
        return _activeSessions.Values.FirstOrDefault(s => s.TemplateId == templateId && s.IsActive);
    }

    public async Task<List<CollaborationSession>> GetActiveSessionsAsync()
    {
        return _activeSessions.Values.Where(s => s.IsActive).ToList();
    }

    private async Task<string> GetTemplateNameAsync(int templateId)
    {
        try
        {
            var template = await _context.LabelTemplates
                .Where(t => t.TemplateId == templateId)
                .Select(t => t.Name)
                .FirstOrDefaultAsync();
            
            return template ?? "Unknown Template";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting template name for template {TemplateId}", templateId);
            return "Unknown Template";
        }
    }

    private async Task<CanvasState?> LoadCanvasStateFromDatabaseAsync(int templateId)
    {
        try
        {
            // Load the template from the database
            var template = await _context.LabelTemplates
                .FirstOrDefaultAsync(t => t.TemplateId == templateId);

            if (template != null)
            {
                // Parse the JsonSchema to get canvas elements
                var elements = new List<object>();
                if (!string.IsNullOrEmpty(template.JsonSchema))
                {
                    try
                    {
                        var schemaData = JsonSerializer.Deserialize<JsonElement>(template.JsonSchema);
                        if (schemaData.TryGetProperty("elements", out var elementsProperty))
                        {
                            var parsedElements = JsonSerializer.Deserialize<List<object>>(elementsProperty.GetRawText());
                            if (parsedElements != null)
                            {
                                elements = parsedElements;
                            }
                        }
                    }
                    catch (JsonException ex)
                    {
                        _logger.LogWarning(ex, "Failed to parse JsonSchema for template {TemplateId}", templateId);
                    }
                }

                return new CanvasState
                {
                    SessionId = string.Empty, // Will be set by the caller
                    Elements = elements,
                    LastUpdated = template.UpdatedAt ?? template.CreatedAt,
                    LastUpdatedBy = 0, // We don't have user info in LabelTemplate
                    Version = 1
                };
            }

            // Return empty state if no template found
            return new CanvasState
            {
                SessionId = string.Empty, // Will be set by the caller
                Elements = new List<object>(),
                LastUpdated = DateTime.UtcNow,
                LastUpdatedBy = 0,
                Version = 1
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading canvas state for template {TemplateId}", templateId);
            return null;
        }
    }

    private string GetNextUserColor()
    {
        var color = _userColors[_colorIndex % _userColors.Length];
        _colorIndex++;
        return color;
    }

    private async Task UpdateActiveTemplatesAsync(CollaborationSession session, int templateId, int userId)
    {
        var existingTemplate = session.ActiveTemplates.FirstOrDefault(t => t.TemplateId == templateId);
        
        if (existingTemplate != null)
        {
            // Add user to existing template if not already there
            if (!existingTemplate.ActiveUserIds.Contains(userId))
            {
                existingTemplate.ActiveUserIds.Add(userId);
            }
            existingTemplate.LastActivity = DateTime.UtcNow;
        }
        else
        {
            // Add new template to session
            var templateName = await GetTemplateNameAsync(templateId);
            session.ActiveTemplates.Add(new SessionTemplate
            {
                TemplateId = templateId,
                TemplateName = templateName,
                ActiveUserIds = new List<int> { userId },
                LastActivity = DateTime.UtcNow
            });
        }
    }
}

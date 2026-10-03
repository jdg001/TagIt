using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using TagIt.Api.Models;
using TagIt.Api.Services;

namespace TagIt.Api.Hubs;

[Authorize]
public class CollaborationHub : Hub
{
    private readonly ICollaborationService _collaborationService;
    private readonly ILogger<CollaborationHub> _logger;

    public CollaborationHub(ICollaborationService collaborationService, ILogger<CollaborationHub> logger)
    {
        _collaborationService = collaborationService;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        var userName = GetUserName();
        var userEmail = GetUserEmail();
        
        _logger.LogInformation("User {UserId} ({UserName}) connected to collaboration hub", userId, userName);
        
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();
        var connectionId = Context.ConnectionId;
        
        _logger.LogInformation("User {UserId} disconnected from collaboration hub", userId);
        
        // Remove user from all sessions
        await _collaborationService.RemoveUserFromAllSessionsAsync(connectionId, userId);
        
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinSession(JoinSessionRequest request)
    {
        try
        {
            var userId = GetUserId();
            var userName = GetUserName();
            var userEmail = GetUserEmail();
            var connectionId = Context.ConnectionId;

            _logger.LogInformation("User {UserId} attempting to join session for template {TemplateId}", userId, request.TemplateId);

            var result = await _collaborationService.JoinSessionAsync(
                connectionId, 
                userId, 
                userName, 
                userEmail, 
                request.TemplateId, 
                request.SessionId);

            if (result.Success && result.SessionId != null)
            {
                // Join the SignalR group for this session
                await Groups.AddToGroupAsync(connectionId, result.SessionId);

                // Send success response to the user
                await Clients.Caller.SendAsync("SessionJoined", result);

                // Notify other users in the session about the new user
                if (result.ConnectedUsers != null)
                {
                    var newUser = result.ConnectedUsers.FirstOrDefault(u => u.UserId == userId);
                    if (newUser != null)
                    {
                        var presenceUpdate = new UserPresenceUpdate
                        {
                            UserId = newUser.UserId,
                            UserName = newUser.UserName,
                            UserEmail = newUser.UserEmail,
                            Color = newUser.Color,
                            Action = "joined",
                            Timestamp = DateTime.UtcNow
                        };

                        await Clients.Group(result.SessionId).SendAsync("UserPresenceUpdate", presenceUpdate);
                    }
                }

                _logger.LogInformation("User {UserId} successfully joined session {SessionId}", userId, result.SessionId);
            }
            else
            {
                await Clients.Caller.SendAsync("SessionJoinFailed", result.ErrorMessage);
                _logger.LogWarning("User {UserId} failed to join session: {Error}", userId, result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error joining session for user {UserId}", GetUserId());
            await Clients.Caller.SendAsync("SessionJoinFailed", "An error occurred while joining the session");
        }
    }

    public async Task LeaveSession(LeaveSessionRequest request)
    {
        try
        {
            var userId = GetUserId();
            var connectionId = Context.ConnectionId;

            _logger.LogInformation("User {UserId} leaving session {SessionId}", userId, request.SessionId);

            var userInfo = await _collaborationService.LeaveSessionAsync(connectionId, userId, request.SessionId);

            if (userInfo != null)
            {
                // Remove from SignalR group
                await Groups.RemoveFromGroupAsync(connectionId, request.SessionId);

                // Notify other users about the user leaving
                var presenceUpdate = new UserPresenceUpdate
                {
                    UserId = userInfo.UserId,
                    UserName = userInfo.UserName,
                    UserEmail = userInfo.UserEmail,
                    Color = userInfo.Color,
                    Action = "left",
                    Timestamp = DateTime.UtcNow
                };

                await Clients.Group(request.SessionId).SendAsync("UserPresenceUpdate", presenceUpdate);

                _logger.LogInformation("User {UserId} successfully left session {SessionId}", userId, request.SessionId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error leaving session for user {UserId}", GetUserId());
        }
    }

    public async Task UpdateCanvas(CanvasElementUpdate update)
    {
        try
        {
            var userId = GetUserId();
            var sessionId = await _collaborationService.GetSessionIdByConnectionIdAsync(Context.ConnectionId);

            if (string.IsNullOrEmpty(sessionId))
            {
                _logger.LogWarning("User {UserId} attempted to update canvas without being in a session", userId);
                return;
            }

            _logger.LogDebug("User {UserId} updating canvas in session {SessionId}: {UpdateType} for element {ElementId}", 
                userId, sessionId, update.UpdateType, update.ElementId);

            // Process the update through the collaboration service
            var processedUpdate = await _collaborationService.ProcessCanvasUpdateAsync(sessionId, userId, update);

            if (processedUpdate != null)
            {
                // Broadcast the update to all users in the session except the sender
                await Clients.GroupExcept(sessionId, Context.ConnectionId).SendAsync("CanvasUpdate", processedUpdate);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating canvas for user {UserId}", GetUserId());
        }
    }

    public async Task UpdateCursor(UpdateCursorRequest request)
    {
        try
        {
            var userId = GetUserId();
            var connectionId = Context.ConnectionId;

            _logger.LogDebug("User {UserId} updating cursor position: ({X}, {Y})", userId, request.X, request.Y);

            var cursorPosition = new CursorPosition
            {
                X = request.X,
                Y = request.Y,
                Timestamp = DateTime.UtcNow
            };

            var userInfo = await _collaborationService.UpdateUserCursorAsync(connectionId, userId, request.SessionId, cursorPosition);

            if (userInfo != null)
            {
                var presenceUpdate = new UserPresenceUpdate
                {
                    UserId = userInfo.UserId,
                    UserName = userInfo.UserName,
                    UserEmail = userInfo.UserEmail,
                    Color = userInfo.Color,
                    Action = "cursor_moved",
                    CursorPosition = cursorPosition,
                    Timestamp = DateTime.UtcNow
                };

                // Broadcast cursor update to all users in the session except the sender
                await Clients.GroupExcept(request.SessionId, connectionId).SendAsync("UserPresenceUpdate", presenceUpdate);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating cursor for user {UserId}", GetUserId());
        }
    }

    public async Task RequestCanvasState()
    {
        try
        {
            var userId = GetUserId();
            var sessionId = await _collaborationService.GetSessionIdByConnectionIdAsync(Context.ConnectionId);

            if (string.IsNullOrEmpty(sessionId))
            {
                _logger.LogWarning("User {UserId} requested canvas state without being in a session", userId);
                return;
            }

            var canvasState = await _collaborationService.GetCanvasStateAsync(sessionId);
            if (canvasState != null)
            {
                await Clients.Caller.SendAsync("CanvasStateReceived", canvasState);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error requesting canvas state for user {UserId}", GetUserId());
        }
    }

    private int GetUserId()
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : 0;
    }

    private string GetUserName()
    {
        return Context.User?.FindFirst(ClaimTypes.Name)?.Value ?? "Unknown User";
    }

    private string GetUserEmail()
    {
        return Context.User?.FindFirst(ClaimTypes.Email)?.Value ?? "unknown@example.com";
    }
}

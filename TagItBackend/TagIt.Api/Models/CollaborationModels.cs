using System.ComponentModel.DataAnnotations;

namespace TagIt.Api.Models;

// Collaboration Session Models
public class CollaborationSession
{
    public string SessionId { get; set; } = string.Empty;
    public int TemplateId { get; set; } // Primary template (first user's template)
    public string TemplateName { get; set; } = string.Empty;
    public List<CollaborationUser> ConnectedUsers { get; set; } = new();
    public List<SessionTemplate> ActiveTemplates { get; set; } = new(); // All templates being worked on
    public CanvasState? CanvasState { get; set; } // Current canvas state for the session
    public DateTime CreatedAt { get; set; }
    public DateTime LastActivity { get; set; }
    public bool IsActive { get; set; } = true;
}

public class SessionTemplate
{
    public int TemplateId { get; set; }
    public string TemplateName { get; set; } = string.Empty;
    public List<int> ActiveUserIds { get; set; } = new(); // Users currently working on this template
    public DateTime LastActivity { get; set; }
}

public class CollaborationUser
{
    public string ConnectionId { get; set; } = string.Empty;
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty; // User's cursor color
    public int CurrentTemplateId { get; set; } // Template user is currently working on
    public string CurrentTemplateName { get; set; } = string.Empty;
    public DateTime JoinedAt { get; set; }
    public DateTime LastSeen { get; set; }
    public bool IsActive { get; set; } = true;
    public CursorPosition? CursorPosition { get; set; }
}

public class CursorPosition
{
    public double X { get; set; }
    public double Y { get; set; }
    public DateTime Timestamp { get; set; }
}

// Canvas Update Models
public class CanvasUpdate
{
    public string SessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string UpdateType { get; set; } = string.Empty; // "element_add", "element_update", "element_delete", "element_move"
    public string ElementId { get; set; } = string.Empty;
    public object? ElementData { get; set; }
    public DateTime Timestamp { get; set; }
    public string OperationId { get; set; } = string.Empty; // For conflict resolution
}

public class CanvasState
{
    public string SessionId { get; set; } = string.Empty;
    public List<object> Elements { get; set; } = new();
    public DateTime LastUpdated { get; set; }
    public int LastUpdatedBy { get; set; } // User ID who last updated the canvas
    public int Version { get; set; }
    public PaperLayout? PaperLayout { get; set; } // Paper layout position for synchronization
}

// Request/Response Models
public class JoinSessionRequest
{
    [Required]
    public int TemplateId { get; set; }
    
    [Required]
    public int UserId { get; set; }
    
    public string? SessionId { get; set; } // Optional: join existing session
}

public class JoinSessionResponse
{
    public bool Success { get; set; }
    public string? SessionId { get; set; }
    public string? ErrorMessage { get; set; }
    public List<CollaborationUser>? ConnectedUsers { get; set; }
    public CanvasState? CurrentCanvasState { get; set; }
}

public class LeaveSessionRequest
{
    [Required]
    public string SessionId { get; set; } = string.Empty;
    
    [Required]
    public int UserId { get; set; }
}

public class UpdateCursorRequest
{
    [Required]
    public string SessionId { get; set; } = string.Empty;
    
    [Required]
    public int UserId { get; set; }
    
    public double X { get; set; }
    public double Y { get; set; }
}

// Hub Method Models
public class CanvasElementUpdate
{
    public string ElementId { get; set; } = string.Empty;
    public string UpdateType { get; set; } = string.Empty;
    public object? ElementData { get; set; }
    public string OperationId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}

public class UserPresenceUpdate
{
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty; // "joined", "left", "cursor_moved"
    public CursorPosition? CursorPosition { get; set; }
    public DateTime Timestamp { get; set; }
}

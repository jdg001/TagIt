-- Collaboration Tables for TagIT
-- These tables support real-time collaboration features

-- Table to store collaboration sessions
CREATE TABLE CollaborationSessions (
    SessionId NVARCHAR(450) PRIMARY KEY,
    TemplateId INT NOT NULL,
    TemplateName NVARCHAR(255) NOT NULL,
    IsPublicLibrarySession BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL,
    LastActivity DATETIME2 NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    FOREIGN KEY (TemplateId) REFERENCES LabelTemplates(TemplateId)
);

-- Table to store collaboration users in sessions
CREATE TABLE CollaborationUsers (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SessionId NVARCHAR(450) NOT NULL,
    ConnectionId NVARCHAR(450) NOT NULL,
    UserId INT NOT NULL,
    UserName NVARCHAR(255) NOT NULL,
    UserEmail NVARCHAR(255) NOT NULL,
    Color NVARCHAR(7) NOT NULL,
    CurrentTemplateId INT NOT NULL,
    CurrentTemplateName NVARCHAR(255) NOT NULL,
    JoinedAt DATETIME2 NOT NULL,
    LastSeen DATETIME2 NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CursorX FLOAT NULL,
    CursorY FLOAT NULL,
    FOREIGN KEY (SessionId) REFERENCES CollaborationSessions(SessionId) ON DELETE CASCADE,
    FOREIGN KEY (UserId) REFERENCES Users(UserId),
    FOREIGN KEY (CurrentTemplateId) REFERENCES LabelTemplates(TemplateId)
);

-- Table to store active templates within sessions (for cross-template collaboration)
CREATE TABLE SessionTemplates (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SessionId NVARCHAR(450) NOT NULL,
    TemplateId INT NOT NULL,
    TemplateName NVARCHAR(255) NOT NULL,
    LastActivity DATETIME2 NOT NULL,
    FOREIGN KEY (SessionId) REFERENCES CollaborationSessions(SessionId) ON DELETE CASCADE,
    FOREIGN KEY (TemplateId) REFERENCES LabelTemplates(TemplateId)
);

-- Table to store which users are active on which templates
CREATE TABLE SessionTemplateUsers (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SessionTemplateId INT NOT NULL,
    UserId INT NOT NULL,
    FOREIGN KEY (SessionTemplateId) REFERENCES SessionTemplates(Id) ON DELETE CASCADE,
    FOREIGN KEY (UserId) REFERENCES Users(UserId)
);

-- Indexes for better performance
CREATE INDEX IX_CollaborationSessions_TemplateId ON CollaborationSessions(TemplateId);
CREATE INDEX IX_CollaborationSessions_IsActive ON CollaborationSessions(IsActive);
CREATE INDEX IX_CollaborationSessions_LastActivity ON CollaborationSessions(LastActivity);

CREATE INDEX IX_CollaborationUsers_SessionId ON CollaborationUsers(SessionId);
CREATE INDEX IX_CollaborationUsers_UserId ON CollaborationUsers(UserId);
CREATE INDEX IX_CollaborationUsers_IsActive ON CollaborationUsers(IsActive);

CREATE INDEX IX_SessionTemplates_SessionId ON SessionTemplates(SessionId);
CREATE INDEX IX_SessionTemplates_TemplateId ON SessionTemplates(TemplateId);

CREATE INDEX IX_SessionTemplateUsers_SessionTemplateId ON SessionTemplateUsers(SessionTemplateId);
CREATE INDEX IX_SessionTemplateUsers_UserId ON SessionTemplateUsers(UserId);

-- Stored procedure to clean up inactive collaboration sessions
CREATE PROCEDURE CleanupInactiveCollaborationSessions
    @InactiveMinutes INT = 30
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Mark sessions as inactive if they haven't been active for the specified minutes
    UPDATE CollaborationSessions 
    SET IsActive = 0 
    WHERE IsActive = 1 
    AND LastActivity < DATEADD(MINUTE, -@InactiveMinutes, GETUTCDATE());
    
    -- Remove users from inactive sessions
    UPDATE CollaborationUsers 
    SET IsActive = 0 
    WHERE IsActive = 1 
    AND SessionId IN (
        SELECT SessionId 
        FROM CollaborationSessions 
        WHERE IsActive = 0
    );
    
    -- Clean up old inactive sessions (older than 24 hours)
    DELETE FROM SessionTemplateUsers 
    WHERE SessionTemplateId IN (
        SELECT st.Id 
        FROM SessionTemplates st
        INNER JOIN CollaborationSessions cs ON st.SessionId = cs.SessionId
        WHERE cs.IsActive = 0 
        AND cs.LastActivity < DATEADD(HOUR, -24, GETUTCDATE())
    );
    
    DELETE FROM SessionTemplates 
    WHERE SessionId IN (
        SELECT SessionId 
        FROM CollaborationSessions 
        WHERE IsActive = 0 
        AND LastActivity < DATEADD(HOUR, -24, GETUTCDATE())
    );
    
    DELETE FROM CollaborationUsers 
    WHERE SessionId IN (
        SELECT SessionId 
        FROM CollaborationSessions 
        WHERE IsActive = 0 
        AND LastActivity < DATEADD(HOUR, -24, GETUTCDATE())
    );
    
    DELETE FROM CollaborationSessions 
    WHERE IsActive = 0 
    AND LastActivity < DATEADD(HOUR, -24, GETUTCDATE());
    
    SELECT @@ROWCOUNT AS CleanedUpSessions;
END;

-- Stored procedure to get active collaboration sessions for a template
CREATE PROCEDURE GetActiveCollaborationSessionsForTemplate
    @TemplateId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        cs.SessionId,
        cs.TemplateId,
        cs.TemplateName,
        cs.IsPublicLibrarySession,
        cs.CreatedAt,
        cs.LastActivity,
        cs.IsActive,
        COUNT(cu.UserId) AS ConnectedUserCount
    FROM CollaborationSessions cs
    LEFT JOIN CollaborationUsers cu ON cs.SessionId = cu.SessionId AND cu.IsActive = 1
    WHERE cs.TemplateId = @TemplateId 
    AND cs.IsActive = 1
    GROUP BY cs.SessionId, cs.TemplateId, cs.TemplateName, cs.IsPublicLibrarySession, 
             cs.CreatedAt, cs.LastActivity, cs.IsActive
    ORDER BY cs.LastActivity DESC;
END;

-- Stored procedure to get users in a collaboration session
CREATE PROCEDURE GetCollaborationSessionUsers
    @SessionId NVARCHAR(450)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        cu.Id,
        cu.SessionId,
        cu.ConnectionId,
        cu.UserId,
        cu.UserName,
        cu.UserEmail,
        cu.Color,
        cu.CurrentTemplateId,
        cu.CurrentTemplateName,
        cu.JoinedAt,
        cu.LastSeen,
        cu.IsActive,
        cu.CursorX,
        cu.CursorY
    FROM CollaborationUsers cu
    WHERE cu.SessionId = @SessionId 
    AND cu.IsActive = 1
    ORDER BY cu.JoinedAt ASC;
END;

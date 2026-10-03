-- ==========================================
-- UserRole Table
-- ==========================================
CREATE TABLE UserRole (
    UserRoleId UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    UserId INT NOT NULL,
    RoleId INT NOT NULL,
    AssignedBy INT NULL, -- Who assigned this role
    AssignedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    IsActive BIT DEFAULT 1,
    ExpiresAt DATETIME2 NULL, -- Optional role expiration
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,

    CONSTRAINT FK_UserRole_Users FOREIGN KEY (UserId) REFERENCES Users(UserId),
    CONSTRAINT FK_UserRole_RolesLookUp FOREIGN KEY (RoleId) REFERENCES RolesLookUp(RoleId),
    CONSTRAINT FK_UserRole_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES Users(UserId),
    CONSTRAINT UQ_UserRole_User_Role UNIQUE (UserId, RoleId)
);

-- Create indexes for better performance
CREATE INDEX IX_UserRole_UserId ON UserRole(UserId);
CREATE INDEX IX_UserRole_RoleId ON UserRole(RoleId);
CREATE INDEX IX_UserRole_IsActive ON UserRole(IsActive);

GO

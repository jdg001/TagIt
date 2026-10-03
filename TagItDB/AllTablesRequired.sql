-- ==========================================
-- TagIt Database - Complete Table Schema
-- ==========================================

USE TagItDB2;
GO

/* ===========================================================
   TENANTS TABLE
   =========================================================== */
IF OBJECT_ID('dbo.Tenants', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Tenants
    (
        TenantId   UNIQUEIDENTIFIER NOT NULL 
                       CONSTRAINT PK_Tenants PRIMARY KEY DEFAULT NEWID(),
        Name       NVARCHAR(200)    NOT NULL,
        Domain     NVARCHAR(255)    NOT NULL,
        CreatedAt  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt  DATETIME2        NULL
    );

    ALTER TABLE dbo.Tenants ADD CONSTRAINT UQ_Tenants_Domain UNIQUE (Domain);
    CREATE INDEX IX_Tenants_Domain ON dbo.Tenants(Domain);
END
GO

/* ===========================================================
   USERS TABLE
   =========================================================== */
USE [TagItDB]
GO
 
/****** Object:  Table [dbo].[Users]    Script Date: 10/5/2025 11:06:44 PM ******/
SET ANSI_NULLS ON
GO
 
SET QUOTED_IDENTIFIER ON
GO
 
CREATE TABLE [dbo].[Users](
	[UserId] [int] IDENTITY(1,1) NOT NULL,
	[Email] [nvarchar](255) NOT NULL,
	[TenantId] [uniqueidentifier] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[IsActive] [bit] NOT NULL,
	[PasswordHash] [nvarchar](max) NULL,
CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED 
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
CONSTRAINT [UQ_Users_Tenant_Email] UNIQUE NONCLUSTERED 
(
	[TenantId] ASC,
	[Email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
 
ALTER TABLE [dbo].[Users] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
 
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((1)) FOR [IsActive]
GO
 
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [FK_Users_Tenants] FOREIGN KEY([TenantId])
REFERENCES [dbo].[Tenants] ([TenantId])
GO
 
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [FK_Users_Tenants]
GO

/* ===========================================================
   ROLES LOOKUP TABLE
   =========================================================== */
IF OBJECT_ID('dbo.RolesLookUp', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RolesLookUp
    (
        RoleId INT IDENTITY(1,1) CONSTRAINT PK_RolesLookUp PRIMARY KEY,
        RoleName NVARCHAR(50) NOT NULL UNIQUE,
        RoleDescription NVARCHAR(200) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NULL
    );
END
GO

/* ===========================================================
   USER ROLE MAPPING TABLE
   =========================================================== */
IF OBJECT_ID('dbo.UserRole', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserRole
    (
        UserId     INT NOT NULL,
        RoleId     INT NOT NULL,
        AssignedBy INT NULL, -- Who assigned this role
        AssignedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        IsActive   BIT NOT NULL DEFAULT 1,
        ExpiresAt  DATETIME2 NULL, -- Optional role expiration
        CreatedAt  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt  DATETIME2 NULL,

        CONSTRAINT PK_UserRole PRIMARY KEY (UserId, RoleId),

        CONSTRAINT FK_UserRole_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_UserRole_RolesLookUp FOREIGN KEY (RoleId) REFERENCES dbo.RolesLookUp(RoleId),
        CONSTRAINT FK_UserRole_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES dbo.Users(UserId)
    );

    CREATE INDEX IX_UserRole_UserId   ON dbo.UserRole(UserId);
    CREATE INDEX IX_UserRole_RoleId   ON dbo.UserRole(RoleId);
END
GO

/* ===========================================================
   LABEL TEMPLATES TABLE
   =========================================================== */
IF OBJECT_ID('dbo.LabelTemplates', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.LabelTemplates
    (
        TemplateId  INT IDENTITY(1,1) 
                    CONSTRAINT PK_LabelTemplates PRIMARY KEY,   -- Unique template ID
        TenantId    UNIQUEIDENTIFIER NULL,                      -- FK if multi-tenant
        Name        NVARCHAR(200) NOT NULL,                     -- Template name
        Description NVARCHAR(500) NULL,                         -- Description of template
        PaperWidth  DECIMAL(10,2) NOT NULL,                     -- Paper width
        PaperHeight DECIMAL(10,2) NOT NULL,                     -- Paper height
        Unit        NVARCHAR(10) NOT NULL,                      -- inch | mm | px
        JsonSchema  NVARCHAR(MAX) NOT NULL,                     -- JSON design
        IsPublished BIT NOT NULL,
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt   DATETIME2 NULL,

        CONSTRAINT FK_LabelTemplates_Tenants FOREIGN KEY (TenantId)
            REFERENCES dbo.Tenants(TenantId)
    );

    CREATE INDEX IX_LabelTemplates_TenantId ON dbo.LabelTemplates(TenantId);
    CREATE INDEX IX_LabelTemplates_Name ON dbo.LabelTemplates(Name);
END
GO

/* ===========================================================
   DESIGN STATE TABLE
   =========================================================== */
IF OBJECT_ID('dbo.DesignState', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DesignState
    (
        DesignStateId INT IDENTITY(1,1) 
                      CONSTRAINT PK_DesignState PRIMARY KEY,
        TemplateId INT NOT NULL,
        DesignerId INT NOT NULL,
        ReviewerId INT NULL, -- Assigned reviewer (can be null initially)
        State NVARCHAR(20) NOT NULL 
              CHECK (State IN ('Draft', 'UnderReview', 'Approved', 'Rejected', 'Published', 'Archived', 'Assigned', 'DeleteUnderReview', 'DeleteAssigned')),
        VersionNumber INT NOT NULL DEFAULT 1,
        Comments NVARCHAR(MAX) NULL, -- Comments from reviewer or designer
        StateChangedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        StateChangedBy INT NOT NULL, -- Who changed the state
        IsPublished BIT NOT NULL DEFAULT 0, -- Whether this version is published
        PublishedAt DATETIME2 NULL, -- When it was published
        PublishedBy INT NULL, -- Who published it

        CONSTRAINT FK_DesignState_Templates     FOREIGN KEY (TemplateId)   REFERENCES dbo.LabelTemplates(TemplateId),
        CONSTRAINT FK_DesignState_Designer      FOREIGN KEY (DesignerId)   REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_DesignState_Reviewer      FOREIGN KEY (ReviewerId)   REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_DesignState_StateChangedBy FOREIGN KEY (StateChangedBy) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_DesignState_PublishedBy   FOREIGN KEY (PublishedBy)  REFERENCES dbo.Users(UserId)
    );

    -- Indexes
    CREATE INDEX IX_DesignState_TemplateId      ON dbo.DesignState(TemplateId);
    CREATE INDEX IX_DesignState_DesignerId      ON dbo.DesignState(DesignerId);
    CREATE INDEX IX_DesignState_ReviewerId      ON dbo.DesignState(ReviewerId);
    CREATE INDEX IX_DesignState_State           ON dbo.DesignState(State);
    CREATE INDEX IX_DesignState_IsPublished     ON dbo.DesignState(IsPublished);
    CREATE INDEX IX_DesignState_VersionNumber   ON dbo.DesignState(VersionNumber);

    -- Composite index to quickly find active version of template
    CREATE INDEX IX_DesignState_Template_Published 
        ON dbo.DesignState(TemplateId, IsPublished);
END
GO

/* ===========================================================
   COMMENTS TABLE
   =========================================================== */
IF OBJECT_ID('dbo.Comments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Comments
    (
        CommentId INT IDENTITY(1,1) PRIMARY KEY,
        DesignStateId INT NOT NULL,
        CommentText NVARCHAR(MAX) NOT NULL,
        PositionX DECIMAL(10,2) NOT NULL, -- Paper-relative X coordinate
        PositionY DECIMAL(10,2) NOT NULL, -- Paper-relative Y coordinate
        -- Paper layout context when comment was created
        PaperLayoutLeft DECIMAL(10,2) NOT NULL DEFAULT 0,
        PaperLayoutTop DECIMAL(10,2) NOT NULL DEFAULT 0,
        PaperLayoutWidth DECIMAL(10,2) NOT NULL DEFAULT 576, -- 6x6 inch default (96 DPI)
        PaperLayoutHeight DECIMAL(10,2) NOT NULL DEFAULT 576,
        CreatedBy INT NOT NULL, -- User who created the comment
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NULL,
        UpdatedBy INT NULL, -- User who last updated the comment
        IsResolved BIT DEFAULT 0, -- Whether comment is resolved
        ResolvedAt DATETIME2 NULL,
        ResolvedBy INT NULL, -- User who resolved the comment
        ResponseText NVARCHAR(MAX) NULL, -- Designer's response to resolved comment

        CONSTRAINT FK_Comments_DesignState FOREIGN KEY (DesignStateId) REFERENCES dbo.DesignState(DesignStateId),
        CONSTRAINT FK_Comments_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_Comments_UpdatedBy FOREIGN KEY (UpdatedBy) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_Comments_ResolvedBy FOREIGN KEY (ResolvedBy) REFERENCES dbo.Users(UserId)
    );

    -- Create indexes for better performance
    CREATE INDEX IX_Comments_DesignStateId ON dbo.Comments(DesignStateId);
    CREATE INDEX IX_Comments_CreatedBy ON dbo.Comments(CreatedBy);
    CREATE INDEX IX_Comments_IsResolved ON dbo.Comments(IsResolved);
    CREATE INDEX IX_Comments_CreatedAt ON dbo.Comments(CreatedAt);

    -- Composite index for common queries
    CREATE INDEX IX_Comments_DesignState_Active ON dbo.Comments(DesignStateId, IsResolved);

    -- Optimized indexes for active comments queries
    CREATE INDEX IX_Comments_Active_Comments 
    ON dbo.Comments(DesignStateId, IsResolved) 
    INCLUDE (CommentId, PositionX, PositionY, CreatedAt, CommentText);
END
GO

/* ===========================================================
   LABEL JOBS TABLE (for tracking generated labels)
   =========================================================== */
IF OBJECT_ID('dbo.LabelJobs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.LabelJobs
    (
        JobId      UNIQUEIDENTIFIER NOT NULL 
                   DEFAULT NEWID() 
                   CONSTRAINT PK_LabelJobs PRIMARY KEY,
        TenantId   UNIQUEIDENTIFIER NULL,
        TemplateId INT NOT NULL,
        InputData  NVARCHAR(MAX) NOT NULL,          -- JSON with actual data
        Status     TINYINT NOT NULL DEFAULT 0,      -- 0=Queued,1=Running,2=Done,3=Failed
        OutputUri  NVARCHAR(1000) NULL,             -- Blob storage / file path / URL
        Error      NVARCHAR(2000) NULL,             -- Error info if failed
        CreatedAt  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt  DATETIME2 NULL,

        CONSTRAINT FK_LabelJobs_Templates FOREIGN KEY (TemplateId)
            REFERENCES dbo.LabelTemplates(TemplateId),
        CONSTRAINT FK_LabelJobs_Tenants FOREIGN KEY (TenantId)
            REFERENCES dbo.Tenants(TenantId)
    );

    CREATE INDEX IX_LabelJobs_TenantId   ON dbo.LabelJobs(TenantId);
    CREATE INDEX IX_LabelJobs_TemplateId ON dbo.LabelJobs(TemplateId);
    CREATE INDEX IX_LabelJobs_Status     ON dbo.LabelJobs(Status);
END
GO

/* ===========================================================
   DEFAULT ROLES SEEDING
   =========================================================== */
IF NOT EXISTS (SELECT 1 FROM dbo.RolesLookUp WHERE RoleName = 'Admin')
    INSERT INTO dbo.RolesLookUp (RoleName, RoleDescription) 
    VALUES ('Admin', 'System administrator with full access to all features and user management');

IF NOT EXISTS (SELECT 1 FROM dbo.RolesLookUp WHERE RoleName = 'Designer')
    INSERT INTO dbo.RolesLookUp (RoleName, RoleDescription) 
    VALUES ('Designer', 'Template designer who can create, edit, and submit templates for review');

IF NOT EXISTS (SELECT 1 FROM dbo.RolesLookUp WHERE RoleName = 'Reviewer')
    INSERT INTO dbo.RolesLookUp (RoleName, RoleDescription) 
    VALUES ('Reviewer', 'Template reviewer who can approve or reject submitted templates');
GO

/* ===========================================================
   INITIAL DATA SEEDING: Tenant + User + Admin Role
   =========================================================== */
DECLARE @TenantId UNIQUEIDENTIFIER;
DECLARE @UserId INT;
DECLARE @RoleId INT;

-- 1. Ensure Tenant exists
IF NOT EXISTS (SELECT 1 FROM dbo.Tenants WHERE Domain = N'tagit.net')
BEGIN
    INSERT INTO dbo.Tenants (Name, Domain)
    VALUES (N'TagIt', N'tagit.net');
END;
SELECT @TenantId = TenantId FROM dbo.Tenants WHERE Domain = N'tagit.net';

-- 2. Ensure User exists in TagIt tenant
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'admin@tagit.net' AND TenantId = @TenantId)
BEGIN
    INSERT INTO dbo.Users (Email, TenantId, PasswordHash)
    VALUES (N'admin@tagit.net', @TenantId, N'tagit@123');
END;
SELECT @UserId = UserId 
FROM dbo.Users 
WHERE Email = N'admin@tagit.net' AND TenantId = @TenantId;

-- 3. Ensure Admin Role exists
SELECT @RoleId = RoleId FROM dbo.RolesLookUp WHERE RoleName = N'Admin';

-- 4. Assign Admin role to the user (idempotent)
IF NOT EXISTS (SELECT 1 FROM dbo.UserRole WHERE UserId = @UserId AND RoleId = @RoleId)
BEGIN
    INSERT INTO dbo.UserRole (UserId, RoleId, AssignedBy, AssignedAt, IsActive)
    VALUES (@UserId, @RoleId, NULL, SYSUTCDATETIME(), 1);
END;

GO
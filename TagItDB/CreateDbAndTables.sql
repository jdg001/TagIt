-- ==========================================
-- Create Database
-- ==========================================
CREATE DATABASE TagItDB;
GO

USE TagItDB;
GO

-- ==========================================
-- Tenants Table (for multi-tenant)
-- ==========================================
CREATE TABLE Tenants (
    TenantId UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
);
GO

-- ==========================================
-- Label Templates Table
-- ==========================================
CREATE TABLE LabelTemplates (
    TemplateId INT IDENTITY(1,1) PRIMARY KEY,   -- Unique template ID
    TenantId UNIQUEIDENTIFIER NULL,             -- FK if multi-tenant
    Name NVARCHAR(200) NOT NULL,                -- Template name
    Description NVARCHAR(500) NULL,             -- Description of template
    PaperWidth DECIMAL(10,2) NOT NULL,          -- Paper width
    PaperHeight DECIMAL(10,2) NOT NULL,         -- Paper height
    Unit NVARCHAR(10) NOT NULL,                 -- inch | mm | px
    JsonSchema NVARCHAR(MAX) NOT NULL,          -- JSON design
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,

    CONSTRAINT FK_LabelTemplates_Tenants FOREIGN KEY (TenantId)
        REFERENCES Tenants(TenantId)
);
GO

-- ==========================================
-- Label Jobs Table (for tracking generated labels)
-- ==========================================
CREATE TABLE LabelJobs (
    JobId UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NULL,
    TemplateId INT NOT NULL,
    InputData NVARCHAR(MAX) NOT NULL,          -- JSON with actual data
    Status TINYINT NOT NULL DEFAULT 0,         -- 0=Queued,1=Running,2=Done,3=Failed
    OutputUri NVARCHAR(1000) NULL,             -- Blob storage / file path / URL
    Error NVARCHAR(2000) NULL,                 -- Error info if failed
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,

    CONSTRAINT FK_LabelJobs_Templates FOREIGN KEY (TemplateId)
        REFERENCES LabelTemplates(TemplateId),
    CONSTRAINT FK_LabelJobs_Tenants FOREIGN KEY (TenantId)
        REFERENCES Tenants(TenantId)
);
GO

-- ==========================================
-- Roles Lookup Table
-- ==========================================
CREATE TABLE RolesLookUp (
    RoleId INT IDENTITY(1,1) PRIMARY KEY,
    RoleName NVARCHAR(50) NOT NULL UNIQUE,
    RoleDescription NVARCHAR(200) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
);

-- Insert default roles
INSERT INTO RolesLookUp (RoleName, RoleDescription) VALUES
('Admin', 'System administrator with full access to all features and user management'),
('Designer', 'Template designer who can create, edit, and submit templates for review'),
('Reviewer', 'Template reviewer who can approve or reject submitted templates');

GO

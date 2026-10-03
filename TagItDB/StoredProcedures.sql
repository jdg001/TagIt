USE [TagItDB2]
GO

/****** Object:  StoredProcedure [dbo].[sp_GetCurrentTemplateState]    Script Date: 10/4/2025 12:15:26 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetCurrentTemplateState]
    @TemplateId INT
AS
BEGIN
    SELECT TOP 1
        ISNULL(ds.DesignStateId, 0) AS DesignStateId,
        ISNULL(ds.TemplateId, 0) AS TemplateId,
        ISNULL(ds.DesignerId, 0) AS DesignerId,
        ISNULL(u1.Email, '') AS DesignerName,
        ds.ReviewerId,
        ISNULL(u2.Email, '') AS ReviewerName,
        ISNULL(ds.State, '') AS State,
        ISNULL(ds.VersionNumber, 0) AS VersionNumber,
        ds.Comments,
        ISNULL(ds.StateChangedAt, GETDATE()) AS StateChangedAt,
        ISNULL(ds.StateChangedBy, 0) AS StateChangedBy,
        ISNULL(u3.Email, '') AS StateChangedByName,
        ISNULL(ds.IsPublished, 0) AS IsPublished,
        ds.PublishedAt,
        ds.PublishedBy,
        ISNULL(u4.Email, '') AS PublishedByName
    FROM DesignState ds
    LEFT JOIN Users u1 ON ds.DesignerId = u1.UserId
    LEFT JOIN Users u2 ON ds.ReviewerId = u2.UserId
    LEFT JOIN Users u3 ON ds.StateChangedBy = u3.UserId
    LEFT JOIN Users u4 ON ds.PublishedBy = u4.UserId
    WHERE ds.TemplateId = @TemplateId
    ORDER BY ds.VersionNumber DESC, ds.StateChangedAt DESC;
END
GO


GO

CREATE PROCEDURE [dbo].[sp_GetTemplateStates]
    @TemplateId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        -- Required fields for non-nullable DTO properties
        ISNULL(ds.DesignStateId, 0) AS DesignStateId,
        ISNULL(ds.TemplateId, 0) AS TemplateId,
        ISNULL(ds.DesignerId, 0) AS DesignerId,
        ISNULL(ds.State, '') AS State,
        ISNULL(ds.VersionNumber, 0) AS VersionNumber,
        ISNULL(ds.StateChangedAt, GETDATE()) AS StateChangedAt,
        ISNULL(ds.StateChangedBy, 0) AS StateChangedBy,
        ISNULL(ds.IsPublished, 0) AS IsPublished,

        -- Nullable fields can stay as-is
        u1.Email AS DesignerName,
        ds.ReviewerId,
        u2.Email AS ReviewerName,
        ds.Comments,
        u3.Email AS StateChangedByName,
        ds.PublishedAt,
        ds.PublishedBy,
        u4.Email AS PublishedByName

    FROM DesignState ds
    LEFT JOIN Users u1 ON ds.DesignerId = u1.UserId
    LEFT JOIN Users u2 ON ds.ReviewerId = u2.UserId
    LEFT JOIN Users u3 ON ds.StateChangedBy = u3.UserId
    LEFT JOIN Users u4 ON ds.PublishedBy = u4.UserId

    WHERE ds.TemplateId = @TemplateId
    ORDER BY ds.VersionNumber DESC;
END
GO

GO

SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetUserRoles]
    @UserId INT
AS
BEGIN
    SELECT 
        ur.UserId,
        ur.RoleId,
        r.RoleName
    FROM UserRole ur
    INNER JOIN RolesLookUp r ON ur.RoleId = r.RoleId
    LEFT JOIN Users u ON ur.UserId = u.UserId
    WHERE ur.UserId = @UserId
END
GO

GO


-- Publish template
CREATE PROCEDURE [dbo].[sp_PublishTemplate]
    @DesignStateId INT,
    @StateChangedBy INT
AS
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Update design state to Published
        UPDATE DesignState 
        SET 
            State = 'Published',
            IsPublished = 1,
            PublishedAt = SYSUTCDATETIME(),
            PublishedBy = @StateChangedBy,
            StateChangedBy = @StateChangedBy,
            StateChangedAt = SYSUTCDATETIME()
        WHERE DesignStateId = @DesignStateId;
        
        COMMIT TRANSACTION;
        SELECT 'SUCCESS' AS Result, 'Template published successfully' AS Message;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 'ERROR' AS Result, ERROR_MESSAGE() AS Message;
    END CATCH
END
GO

GO


-- Reject template
CREATE PROCEDURE [dbo].[sp_RejectTemplate]
    @DesignStateId INT,
    @Comments NVARCHAR(MAX),
    @StateChangedBy INT
AS
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Update design state to Rejected
        UPDATE DesignState 
        SET 
            State = 'Rejected',
            Comments = @Comments,
            StateChangedBy = @StateChangedBy,
            StateChangedAt = SYSUTCDATETIME()
        WHERE DesignStateId = @DesignStateId;
        
        COMMIT TRANSACTION;
        SELECT 'SUCCESS' AS Result, 'Template rejected successfully' AS Message;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 'ERROR' AS Result, ERROR_MESSAGE() AS Message;
    END CATCH
END
GO


GO

CREATE PROCEDURE [dbo].[sp_SubmitForReview]
    @DesignStateId INT,
    @ReviewerId INT = NULL,              -- allow null
    @Comments NVARCHAR(MAX) = NULL,
    @StateChangedBy INT
AS
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Update design state to UnderReview
        UPDATE DesignState 
        SET 
            State = 'UnderReview',
            ReviewerId = @ReviewerId,    -- can be null now
            Comments = @Comments,
            StateChangedBy = @StateChangedBy,
            StateChangedAt = SYSUTCDATETIME()
        WHERE DesignStateId = @DesignStateId;
        
        COMMIT TRANSACTION;

        SELECT 'SUCCESS' AS Result, 'Template submitted for review successfully' AS Message;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 'ERROR' AS Result, ERROR_MESSAGE() AS Message;
    END CATCH
END
GO

GO
CREATE PROCEDURE [dbo].[sp_UnassignReviewer]
    @DesignStateId INT,
    @UnassignedBy INT,
    @Comments NVARCHAR(MAX) = NULL
AS
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Validate design state exists
        IF NOT EXISTS (SELECT 1 FROM DesignState WHERE DesignStateId = @DesignStateId)
        BEGIN
            SELECT 'ERROR' AS Result, 'Design state not found' AS Message;
            ROLLBACK TRANSACTION;
            RETURN;
        END
        
        -- Update design state to remove reviewer assignment
        UPDATE DesignState 
        SET
            ReviewerId = NULL,
            StateChangedAt = SYSUTCDATETIME(),
            StateChangedBy = @UnassignedBy,
            Comments = ISNULL(@Comments, Comments)
        WHERE DesignStateId = @DesignStateId;
        
        -- Check if update was successful
        IF @@ROWCOUNT = 0
        BEGIN
            SELECT 'ERROR' AS Result, 'Failed to unassign reviewer' AS Message;
            ROLLBACK TRANSACTION;
            RETURN;
        END
        
        COMMIT TRANSACTION;
        SELECT 'SUCCESS' AS Result, 'Reviewer unassigned successfully' AS Message;
        
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 'ERROR' AS Result, ERROR_MESSAGE() AS Message;
    END CATCH
END
GO

GO
CREATE PROCEDURE [dbo].[sp_UpdateDesignState]
    @DesignStateId INT,
    @NewState NVARCHAR(20),
    @Comments NVARCHAR(MAX) = NULL,
    @StateChangedAt DATETIME,
    @StateChangedBy INT,
    @ReviewerId INT = NULL
AS
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
        
        DECLARE @TemplateId INT;
        
        -- Update the design state
        UPDATE DesignState 
        SET 
            State = @NewState,
            Comments = @Comments,
            StateChangedBy = @StateChangedBy,
            StateChangedAt = SYSUTCDATETIME(),
            ReviewerId = ISNULL(@ReviewerId, ReviewerId)
        WHERE DesignStateId = @DesignStateId;
        
        -- If publishing, set published fields
        IF @NewState = 'Published'
        BEGIN
            UPDATE DesignState 
            SET 
                IsPublished = 1,
                PublishedAt = SYSUTCDATETIME(),
                PublishedBy = @StateChangedBy
            WHERE DesignStateId = @DesignStateId;
        END
        
        COMMIT TRANSACTION;
        SELECT 'SUCCESS' AS Result, 'Design state updated successfully' AS Message;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 'ERROR' AS Result, ERROR_MESSAGE() AS Message;
    END CATCH
END
GO

GO

CREATE PROCEDURE [dbo].[sp_CreateDesignState]
    @TemplateId INT,
    @DesignerId INT,
    @ReviewerId INT = NULL,
    @State NVARCHAR(20),
    @VersionNumber INT,
    @Comments NVARCHAR(MAX) = NULL,
	@StateChangedAt DATETIME,
    @StateChangedBy INT,
	@IsPublished BIT = 0,
	@PublishedAt DATETIME,
    @PublishedBy INT
AS
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
        -- Insert new design state
        INSERT INTO dbo.DesignState (
            TemplateId, DesignerId, ReviewerId, State, 
            VersionNumber, Comments, StateChangedAt, StateChangedBy, IsPublished, PublishedAt, PublishedBy
        )
        VALUES (
            @TemplateId, @DesignerId, @ReviewerId, @State,
            @VersionNumber, @Comments, @StateChangedAt, @StateChangedBy, @IsPublished,
			@PublishedAt, @PublishedBy
        );
        
        COMMIT TRANSACTION;
        SELECT 'SUCCESS' AS Result, 'Design state created successfully' AS Message;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 'ERROR' AS Result, ERROR_MESSAGE() AS Message;
    END CATCH
END
GO

GO

SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_AssignReviewer]
    @DesignStateId INT,
    @ReviewerId INT,
    @AssignedBy INT,
    @Comments NVARCHAR(MAX) = NULL
AS
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Validate design state exists
        IF NOT EXISTS (SELECT 1 FROM DesignState WHERE DesignStateId = @DesignStateId)
        BEGIN
            SELECT 'ERROR' AS Result, 'Design state not found' AS Message;
            ROLLBACK TRANSACTION;
            RETURN;
        END
        
        -- Validate reviewer exists
        IF NOT EXISTS (SELECT 1 FROM Users WHERE UserId = @ReviewerId)
        BEGIN
            SELECT 'ERROR' AS Result, 'Reviewer not found' AS Message;
            ROLLBACK TRANSACTION;
            RETURN;
        END
        
        -- Update design state with reviewer assignment
        UPDATE DesignState 
        SET
            ReviewerId = @ReviewerId,
            StateChangedAt = SYSUTCDATETIME(),
            StateChangedBy = @AssignedBy,
            Comments = ISNULL(@Comments, Comments)
        WHERE DesignStateId = @DesignStateId;
        
        -- Check if update was successful
        IF @@ROWCOUNT = 0
        BEGIN
            SELECT 'ERROR' AS Result, 'Failed to assign reviewer' AS Message;
            ROLLBACK TRANSACTION;
            RETURN;
        END
        
        COMMIT TRANSACTION;
        SELECT 'SUCCESS' AS Result, 'Reviewer assigned successfully' AS Message;
        
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 'ERROR' AS Result, ERROR_MESSAGE() AS Message;
    END CATCH
END
GO

GO


-- Approve template
CREATE PROCEDURE [dbo].[sp_ApproveTemplate]
    @DesignStateId INT,
    @Comments NVARCHAR(MAX) = NULL,
    @StateChangedBy INT
AS
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Update design state to Approved
        UPDATE DesignState 
        SET 
            State = 'Approved',
            Comments = @Comments,
            StateChangedBy = @StateChangedBy,
            StateChangedAt = SYSUTCDATETIME()
        WHERE DesignStateId = @DesignStateId;
        
        COMMIT TRANSACTION;
        SELECT 'SUCCESS' AS Result, 'Template approved successfully' AS Message;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 'ERROR' AS Result, ERROR_MESSAGE() AS Message;
    END CATCH
END
GO
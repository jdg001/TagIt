-- 1. Create Design State
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
        IF @StateChangedAt IS NULL
            SET @StateChangedAt = SYSUTCDATETIME();
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

-- 2. Update Design State
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
        
        -- Update design state
        UPDATE DesignState 
        SET
            State = @NewState,
            Comments = ISNULL(@Comments, Comments),
            StateChangedAt = @StateChangedAt,
            StateChangedBy = @StateChangedBy,
            ReviewerId = ISNULL(@ReviewerId, ReviewerId)
        WHERE DesignStateId = @DesignStateId;
        
        COMMIT TRANSACTION;
        SELECT 'SUCCESS' AS Result, 'Design state updated successfully' AS Message;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 'ERROR' AS Result, ERROR_MESSAGE() AS Message;
    END CATCH
END
GO

-- 3. Get Current Template State
CREATE PROCEDURE [dbo].[sp_GetCurrentTemplateState]
    @TemplateId INT
AS
BEGIN
    SELECT TOP 1
        ds.DesignStateId,
        ds.TemplateId,
        ds.DesignerId,
        u.Email AS DesignerName,
        ds.ReviewerId,
        r.Email AS ReviewerName,
        ds.State,
        ds.VersionNumber,
        ds.Comments,
        ds.StateChangedAt,
        ds.StateChangedBy,
        scb.Email AS StateChangedByName,
        ds.IsPublished,
        ds.PublishedAt,
        ds.PublishedBy,
        pb.Email AS PublishedByName
    FROM DesignState ds
    INNER JOIN Users u ON ds.DesignerId = u.UserId
    LEFT JOIN Users r ON ds.ReviewerId = r.UserId
    LEFT JOIN Users scb ON ds.StateChangedBy = scb.UserId
    LEFT JOIN Users pb ON ds.PublishedBy = pb.UserId
    WHERE ds.TemplateId = @TemplateId
    ORDER BY ds.StateChangedAt DESC;
END
GO

-- 4. Get Template States
CREATE PROCEDURE [dbo].[sp_GetTemplateStates]
    @TemplateId INT
AS
BEGIN
    SELECT
        ds.DesignStateId,
        ds.TemplateId,
        ds.DesignerId,
        u.Email AS DesignerName,
        ds.ReviewerId,
        r.Email AS ReviewerName,
        ds.State,
        ds.VersionNumber,
        ds.Comments,
        ds.StateChangedAt,
        ds.StateChangedBy,
        scb.Email AS StateChangedByName,
        ds.IsPublished,
        ds.PublishedAt,
        ds.PublishedBy,
        pb.Email AS PublishedByName
    FROM DesignState ds
    INNER JOIN Users u ON ds.DesignerId = u.UserId
    LEFT JOIN Users r ON ds.ReviewerId = r.UserId
    LEFT JOIN Users scb ON ds.StateChangedBy = scb.UserId
    LEFT JOIN Users pb ON ds.PublishedBy = pb.UserId
    WHERE ds.TemplateId = @TemplateId
    ORDER BY ds.StateChangedAt DESC;
END
GO

-- 5. Approve Template
CREATE PROCEDURE [dbo].[sp_ApproveTemplate]
    @DesignStateId INT,
    @Comments NVARCHAR(MAX) = NULL,
    @StateChangedBy INT
AS
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
        
        UPDATE DesignState 
        SET
            State = CASE 
                WHEN State IN ('DeleteUnderReview', 'DeleteAssigned') THEN 'DeleteApproved' -- Delete requests become approved for deletion
                ELSE 'Approved' -- Regular templates become approved
            END,
            Comments = ISNULL(@Comments, Comments),
            StateChangedAt = SYSUTCDATETIME(),
            StateChangedBy = @StateChangedBy
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

-- 6. Reject Template
CREATE PROCEDURE [dbo].[sp_RejectTemplate]
    @DesignStateId INT,
    @Comments NVARCHAR(MAX),
    @StateChangedBy INT
AS
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
        
        UPDATE DesignState 
        SET
            State = CASE 
                WHEN State IN ('DeleteUnderReview', 'DeleteAssigned') THEN 'Published' -- Delete requests go back to published
                ELSE 'Rejected' -- Regular templates become rejected
            END,
            IsPublished = CASE 
                WHEN State IN ('DeleteUnderReview', 'DeleteAssigned') THEN 1 -- Ensure delete requests remain published
                ELSE IsPublished -- Keep existing published status for regular templates
            END,
            Comments = @Comments,
            StateChangedAt = SYSUTCDATETIME(),
            StateChangedBy = @StateChangedBy
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

-- 7. Publish Template
CREATE PROCEDURE [dbo].[sp_PublishTemplate]
    @DesignStateId INT,
    @StateChangedBy INT
AS
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
        
        UPDATE DesignState 
        SET
            State = 'Published',
            IsPublished = 1,
            PublishedAt = SYSUTCDATETIME(),
            PublishedBy = @StateChangedBy,
            StateChangedAt = SYSUTCDATETIME(),
            StateChangedBy = @StateChangedBy
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

-- 8. Submit for Review
CREATE PROCEDURE [dbo].[sp_SubmitForReview]
    @DesignStateId INT,
    @ReviewerId INT = NULL,
    @Comments NVARCHAR(MAX) = NULL,
    @StateChangedBy INT,
    @IsDeleteRequest BIT = 0
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
        
        -- Update design state with conditional status based on reviewer assignment and delete request
        UPDATE DesignState 
        SET
            State = CASE 
                WHEN @IsDeleteRequest = 1 THEN 
                    CASE 
                        WHEN @ReviewerId IS NOT NULL THEN 'DeleteAssigned'
                        ELSE 'DeleteUnderReview'
                    END
                ELSE 
                    CASE 
                        WHEN @ReviewerId IS NOT NULL THEN 'Assigned'
                        ELSE 'UnderReview'
                    END
            END,
            ReviewerId = @ReviewerId,
            Comments = ISNULL(@Comments, Comments),
            StateChangedAt = SYSUTCDATETIME(),
            StateChangedBy = @StateChangedBy
        WHERE DesignStateId = @DesignStateId;
        
        -- Check if update was successful
        IF @@ROWCOUNT = 0
        BEGIN
            SELECT 'ERROR' AS Result, 'Failed to submit for review' AS Message;
            ROLLBACK TRANSACTION;
            RETURN;
        END
        
        COMMIT TRANSACTION;
        SELECT 'SUCCESS' AS Result, 
            CASE 
                WHEN @IsDeleteRequest = 1 THEN 'Delete request submitted for review successfully'
                ELSE 'Template submitted for review successfully'
            END AS Message;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 'ERROR' AS Result, ERROR_MESSAGE() AS Message;
    END CATCH
END
GO
-- 9. Assign Reviewer
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
            State = CASE 
                WHEN State = 'DeleteUnderReview' THEN 'DeleteAssigned' -- Delete requests become delete assigned
                WHEN State = 'UnderReview' THEN 'Assigned' -- Regular templates become assigned
                ELSE State -- Keep other states unchanged
            END,
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

-- 10. Unassign Reviewer
CREATE PROCEDURE [dbo].[sp_UnassignReviewer]
    @DesignStateId INT,
    @UnassignedBy INT,
    @Comments NVARCHAR(MAX) = NULL
AS
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
        
        UPDATE DesignState 
        SET
            ReviewerId = NULL,
            State = CASE 
                WHEN State = 'DeleteAssigned' THEN 'DeleteUnderReview' -- Delete assigned becomes delete under review
                WHEN State = 'Assigned' THEN 'UnderReview' -- Regular assigned becomes under review
                ELSE State -- Keep other states unchanged
            END,
            StateChangedAt = SYSUTCDATETIME(),
            StateChangedBy = @UnassignedBy,
            Comments = ISNULL(@Comments, Comments)
        WHERE DesignStateId = @DesignStateId;
        
        COMMIT TRANSACTION;
        SELECT 'SUCCESS' AS Result, 'Reviewer unassigned successfully' AS Message;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 'ERROR' AS Result, ERROR_MESSAGE() AS Message;
    END CATCH
END
GO

-- 11. Get Designer Dashboard
CREATE PROCEDURE [dbo].[sp_GetDesignerDashboard]
    @DesignerId INT
AS
BEGIN
    -- Draft Templates
    SELECT 
        'Draft' AS DataType,
        ds.DesignStateId,
        ds.TemplateId,
        lt.Name AS TemplateName,
        lt.Description AS TemplateDescription,
        lt.PaperWidth,
        lt.PaperHeight,
        lt.Unit,
        ds.DesignerId,
        u.Email AS DesignerName,
        ds.ReviewerId,
        r.Email AS ReviewerName,
        ds.State,
        ds.VersionNumber,
        ds.StateChangedAt,
        ds.IsPublished,
        ds.PublishedAt,
        ds.PublishedBy,
        pub.Email AS PublishedByName
    FROM DesignState ds
    INNER JOIN LabelTemplates lt ON ds.TemplateId = lt.TemplateId
    INNER JOIN Users u ON ds.DesignerId = u.UserId
    LEFT JOIN Users r ON ds.ReviewerId = r.UserId
    LEFT JOIN Users pub ON ds.PublishedBy = pub.UserId
    WHERE ds.DesignerId = @DesignerId AND ds.State = 'Draft'
    
    UNION ALL
    
    -- Submitted Templates
    SELECT 
        'Submitted' AS DataType,
        ds.DesignStateId,
        ds.TemplateId,
        lt.Name AS TemplateName,
        lt.Description AS TemplateDescription,
        lt.PaperWidth,
        lt.PaperHeight,
        lt.Unit,
        ds.DesignerId,
        u.Email AS DesignerName,
        ds.ReviewerId,
        r.Email AS ReviewerName,
        ds.State,
        ds.VersionNumber,
        ds.StateChangedAt,
        ds.IsPublished,
        ds.PublishedAt,
        ds.PublishedBy,
        pub.Email AS PublishedByName
    FROM DesignState ds
    INNER JOIN LabelTemplates lt ON ds.TemplateId = lt.TemplateId
    INNER JOIN Users u ON ds.DesignerId = u.UserId
    LEFT JOIN Users r ON ds.ReviewerId = r.UserId
    LEFT JOIN Users pub ON ds.PublishedBy = pub.UserId
    WHERE ds.DesignerId = @DesignerId AND (ds.State = 'UnderReview' OR ds.State = 'Assigned' OR ds.State = 'Approved')
    
    UNION ALL
    
    -- Rejected Templates
    SELECT 
        'Rejected' AS DataType,
        ds.DesignStateId,
        ds.TemplateId,
        lt.Name AS TemplateName,
        lt.Description AS TemplateDescription,
        lt.PaperWidth,
        lt.PaperHeight,
        lt.Unit,
        ds.DesignerId,
        u.Email AS DesignerName,
        ds.ReviewerId,
        r.Email AS ReviewerName,
        ds.State,
        ds.VersionNumber,
        ds.StateChangedAt,
        ds.IsPublished,
        ds.PublishedAt,
        ds.PublishedBy,
        pub.Email AS PublishedByName
    FROM DesignState ds
    INNER JOIN LabelTemplates lt ON ds.TemplateId = lt.TemplateId
    INNER JOIN Users u ON ds.DesignerId = u.UserId
    LEFT JOIN Users r ON ds.ReviewerId = r.UserId
    LEFT JOIN Users pub ON ds.PublishedBy = pub.UserId
    WHERE ds.DesignerId = @DesignerId AND ds.State = 'Rejected'
    
    ORDER BY DataType, StateChangedAt DESC;
END
GO

-- 12. Get Reviewer Dashboard
CREATE PROCEDURE [dbo].[sp_GetReviewerDashboard]
    @ReviewerId INT
AS
BEGIN
    -- Pending Reviews (assigned to this reviewer with state 'UnderReview')
    SELECT 
        'PendingReviews' AS DataType,
        ds.DesignStateId,
        ds.TemplateId,
        lt.Name AS TemplateName,
        lt.Description AS TemplateDescription,
        lt.PaperWidth,
        lt.PaperHeight,
        lt.Unit,
        ds.DesignerId,
        u.Email AS DesignerName,
        ds.ReviewerId,
        r.Email AS ReviewerName,
        ds.State,
        ds.VersionNumber,
        ds.StateChangedAt,
        ds.IsPublished,
        ds.PublishedAt,
        ds.PublishedBy,
        pub.Email AS PublishedByName
    FROM DesignState ds
    INNER JOIN LabelTemplates lt ON ds.TemplateId = lt.TemplateId
    INNER JOIN Users u ON ds.DesignerId = u.UserId
    LEFT JOIN Users r ON ds.ReviewerId = r.UserId
    LEFT JOIN Users pub ON ds.PublishedBy = pub.UserId
    WHERE ds.ReviewerId = @ReviewerId AND ds.State = 'UnderReview'
    
    UNION ALL
    
    -- All Submissions (all templates under review - for assignment)
    SELECT 
        'AllSubmissions' AS DataType,
        ds.DesignStateId,
        ds.TemplateId,
        lt.Name AS TemplateName,
        lt.Description AS TemplateDescription,
        lt.PaperWidth,
        lt.PaperHeight,
        lt.Unit,
        ds.DesignerId,
        u.Email AS DesignerName,
        ds.ReviewerId,
        r.Email AS ReviewerName,
        ds.State,
        ds.VersionNumber,
        ds.StateChangedAt,
        ds.IsPublished,
        ds.PublishedAt,
        ds.PublishedBy,
        pub.Email AS PublishedByName
    FROM DesignState ds
    INNER JOIN LabelTemplates lt ON ds.TemplateId = lt.TemplateId
    INNER JOIN Users u ON ds.DesignerId = u.UserId
    LEFT JOIN Users r ON ds.ReviewerId = r.UserId
    LEFT JOIN Users pub ON ds.PublishedBy = pub.UserId
    WHERE ds.State = 'UnderReview'
    
    UNION ALL
    
    -- Assigned Templates (assigned to this reviewer with state 'Assigned' or 'Approved')
    SELECT 
        'Assigned' AS DataType,
        ds.DesignStateId,
        ds.TemplateId,
        lt.Name AS TemplateName,
        lt.Description AS TemplateDescription,
        lt.PaperWidth,
        lt.PaperHeight,
        lt.Unit,
        ds.DesignerId,
        u.Email AS DesignerName,
        ds.ReviewerId,
        r.Email AS ReviewerName,
        ds.State,
        ds.VersionNumber,
        ds.StateChangedAt,
        ds.IsPublished,
        ds.PublishedAt,
        ds.PublishedBy,
        pub.Email AS PublishedByName
    FROM DesignState ds
    INNER JOIN LabelTemplates lt ON ds.TemplateId = lt.TemplateId
    INNER JOIN Users u ON ds.DesignerId = u.UserId
    LEFT JOIN Users r ON ds.ReviewerId = r.UserId
    LEFT JOIN Users pub ON ds.PublishedBy = pub.UserId
    WHERE ds.ReviewerId = @ReviewerId AND (ds.State = 'Assigned' OR ds.State = 'Approved')
    
    ORDER BY DataType, StateChangedAt DESC;
END
GO

-- 14. Get All Roles
CREATE PROCEDURE [dbo].[sp_GetAllRoles]
AS
BEGIN
    SELECT 
        RoleId,
        RoleName,
        RoleDescription,
        IsActive,
        CreatedAt,
        UpdatedAt
    FROM RolesLookUp
    WHERE IsActive = 1
    ORDER BY RoleName;
END
GO

-- 15. Get User Roles
CREATE PROCEDURE [dbo].[sp_GetUserRoles]
    @UserId INT
AS
BEGIN
    SELECT 
        ur.UserId,
        ur.RoleId,
        r.RoleName,
        r.RoleDescription,
        ur.IsActive,
        ur.AssignedAt,
        ur.AssignedBy,
        ur.ExpiresAt,
        ur.CreatedAt,
        ur.UpdatedAt
    FROM UserRole ur
    INNER JOIN RolesLookUp r ON ur.RoleId = r.RoleId
    WHERE ur.UserId = @UserId
    ORDER BY r.RoleName;
END
GO

-- ==========================================
-- Comment Stored Procedures (Hard Delete Version)
-- ==========================================

-- Get all comments for a design state
CREATE PROCEDURE sp_GetCommentsByDesignStateId
    @DesignStateId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        c.CommentId,
        c.DesignStateId,
        c.CommentText,
        c.PositionX,
        c.PositionY,
        c.PaperLayoutLeft,    -- [NEW] Paper layout context
        c.PaperLayoutTop,     -- [NEW] Paper layout context
        c.PaperLayoutWidth,   -- [NEW] Paper layout context
        c.PaperLayoutHeight,  -- [NEW] Paper layout context
        c.CreatedBy,
        u1.Email AS CreatedByName,
        c.CreatedAt,
        c.UpdatedAt,
        c.UpdatedBy,
        u2.Email AS UpdatedByName,
        c.IsResolved,
        c.ResolvedAt,
        c.ResolvedBy,
        u3.Email AS ResolvedByName,
        c.ResponseText
    FROM Comments c
    LEFT JOIN Users u1 ON c.CreatedBy = u1.UserId
    LEFT JOIN Users u2 ON c.UpdatedBy = u2.UserId
    LEFT JOIN Users u3 ON c.ResolvedBy = u3.UserId
    WHERE c.DesignStateId = @DesignStateId
    ORDER BY c.CreatedAt;
END;
GO

-- Check if design state has unresolved comments
CREATE PROCEDURE sp_HasUnresolvedComments
    @DesignStateId INT,
    @HasUnresolved BIT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (
        SELECT 1 
        FROM Comments 
        WHERE DesignStateId = @DesignStateId 
          AND IsResolved = 0
    )
        SET @HasUnresolved = 1;
    ELSE
        SET @HasUnresolved = 0;
END;
GO

-- Get count of unresolved comments for a design state
CREATE PROCEDURE sp_GetUnresolvedCommentCount
    @DesignStateId INT,
    @CommentCount INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT @CommentCount = COUNT(*)
    FROM Comments 
    WHERE DesignStateId = @DesignStateId 
      AND IsResolved = 0;
END;
GO

-- Create a new comment
CREATE PROCEDURE sp_CreateComment
    @DesignStateId INT,
    @CommentText NVARCHAR(MAX),
    @PositionX DECIMAL(10,2),
    @PositionY DECIMAL(10,2),
    @PaperLayoutLeft DECIMAL(10,2),    -- [NEW] Paper layout context
    @PaperLayoutTop DECIMAL(10,2),     -- [NEW] Paper layout context
    @PaperLayoutWidth DECIMAL(10,2),   -- [NEW] Paper layout context
    @PaperLayoutHeight DECIMAL(10,2),  -- [NEW] Paper layout context
    @CreatedBy INT,
    @CommentId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO Comments (
        DesignStateId,
        CommentText,
        PositionX,
        PositionY,
        PaperLayoutLeft,    -- [NEW] Paper layout context
        PaperLayoutTop,     -- [NEW] Paper layout context
        PaperLayoutWidth,   -- [NEW] Paper layout context
        PaperLayoutHeight,  -- [NEW] Paper layout context
        CreatedBy,
        CreatedAt,
        IsResolved
    )
    VALUES (
        @DesignStateId,
        @CommentText,
        @PositionX,
        @PositionY,
        @PaperLayoutLeft,    -- [NEW] Paper layout context
        @PaperLayoutTop,     -- [NEW] Paper layout context
        @PaperLayoutWidth,   -- [NEW] Paper layout context
        @PaperLayoutHeight,  -- [NEW] Paper layout context
        @CreatedBy,
        SYSUTCDATETIME(),
        0
    );
    
    SET @CommentId = SCOPE_IDENTITY();
END;
GO

-- Update a comment
CREATE PROCEDURE sp_UpdateComment
    @CommentId INT,
    @CommentText NVARCHAR(MAX),
    @PositionX DECIMAL(10,2),
    @PositionY DECIMAL(10,2),
    @PaperLayoutLeft DECIMAL(10,2),    -- [NEW] Paper layout context
    @PaperLayoutTop DECIMAL(10,2),     -- [NEW] Paper layout context
    @PaperLayoutWidth DECIMAL(10,2),   -- [NEW] Paper layout context
    @PaperLayoutHeight DECIMAL(10,2),  -- [NEW] Paper layout context
    @UpdatedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE Comments 
    SET CommentText = @CommentText,
        PositionX = @PositionX,
        PositionY = @PositionY,
        PaperLayoutLeft = @PaperLayoutLeft,    -- [NEW] Paper layout context
        PaperLayoutTop = @PaperLayoutTop,      -- [NEW] Paper layout context
        PaperLayoutWidth = @PaperLayoutWidth,  -- [NEW] Paper layout context
        PaperLayoutHeight = @PaperLayoutHeight, -- [NEW] Paper layout context
        UpdatedBy = @UpdatedBy,
        UpdatedAt = SYSUTCDATETIME()
    WHERE CommentId = @CommentId;
END;
GO

-- Resolve a comment
CREATE PROCEDURE sp_ResolveComment
    @CommentId INT,
    @ResolvedBy INT,
    @ResponseText NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE Comments 
    SET IsResolved = 1,
        ResolvedBy = @ResolvedBy,
        ResolvedAt = SYSUTCDATETIME(),
        ResponseText = @ResponseText
    WHERE CommentId = @CommentId;
END;
GO

-- Hard delete a comment
CREATE PROCEDURE sp_DeleteComment
    @CommentId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DELETE FROM Comments 
    WHERE CommentId = @CommentId;
END;
GO

-- Get comment by ID
CREATE PROCEDURE sp_GetCommentById
    @CommentId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        c.CommentId,
        c.DesignStateId,
        c.CommentText,
        c.PositionX,
        c.PositionY,
        c.PaperLayoutLeft,    -- [NEW] Paper layout context
        c.PaperLayoutTop,     -- [NEW] Paper layout context
        c.PaperLayoutWidth,   -- [NEW] Paper layout context
        c.PaperLayoutHeight,  -- [NEW] Paper layout context
        c.CreatedBy,
        u1.Email AS CreatedByName,
        c.CreatedAt,
        c.UpdatedAt,
        c.UpdatedBy,
        u2.Email AS UpdatedByName,
        c.IsResolved,
        c.ResolvedAt,
        c.ResolvedBy,
        u3.Email AS ResolvedByName,
        c.ResponseText
    FROM Comments c
    LEFT JOIN Users u1 ON c.CreatedBy = u1.UserId
    LEFT JOIN Users u2 ON c.UpdatedBy = u2.UserId
    LEFT JOIN Users u3 ON c.ResolvedBy = u3.UserId
    WHERE c.CommentId = @CommentId;
END;
GO

-- Get All user roles
--CREATE PROCEDURE [dbo].[sp_GetAllRoles]
--AS
--BEGIN
--    SET NOCOUNT ON;
    
--    SELECT 
--        RoleId,
--        RoleName,
--        RoleDescription,
--        IsActive,
--        CreatedAt,
--        UpdatedAt
--    FROM RolesLookUp
--    WHERE IsActive = 1
--    ORDER BY RoleName;
--END
--GO
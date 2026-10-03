-- ==========================================
-- DesignState Table
-- ==========================================
CREATE TABLE DesignState (
    DesignStateId INT IDENTITY(1,1) PRIMARY KEY,
    TemplateId INT NOT NULL,
    DesignerId INT NOT NULL,
    ReviewerId INT NULL, -- Assigned reviewer (can be null initially)
    State NVARCHAR(20) NOT NULL CHECK (State IN ('Draft', 'UnderReview', 'Approved', 'Rejected', 'Published', 'Archived')),
    VersionNumber INT NOT NULL DEFAULT 1,
    Comments NVARCHAR(MAX) NULL, -- Comments from reviewer or designer
    StateChangedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    StateChangedBy INT NOT NULL, -- Who changed the state
    IsPublished BIT DEFAULT 0, -- Whether this version is published to public library
    PublishedAt DATETIME2 NULL, -- When it was published
    PublishedBy INT NULL, -- Who published it

    CONSTRAINT FK_DesignState_Templates FOREIGN KEY (TemplateId) REFERENCES LabelTemplates(TemplateId),
    CONSTRAINT FK_DesignState_Designer FOREIGN KEY (DesignerId) REFERENCES Users(UserId),
    CONSTRAINT FK_DesignState_Reviewer FOREIGN KEY (ReviewerId) REFERENCES Users(UserId),
    CONSTRAINT FK_DesignState_StateChangedBy FOREIGN KEY (StateChangedBy) REFERENCES Users(UserId),
    CONSTRAINT FK_DesignState_PublishedBy FOREIGN KEY (PublishedBy) REFERENCES Users(UserId)
);

-- Create indexes for better performance
CREATE INDEX IX_DesignState_TemplateId ON DesignState(TemplateId);
CREATE INDEX IX_DesignState_DesignerId ON DesignState(DesignerId);
CREATE INDEX IX_DesignState_ReviewerId ON DesignState(ReviewerId);
CREATE INDEX IX_DesignState_DesignState ON DesignState(DesignState);
CREATE INDEX IX_DesignState_IsActive ON DesignState(IsActive);
CREATE INDEX IX_DesignState_IsPublished ON DesignState(IsPublished);
CREATE INDEX IX_DesignState_VersionNumber ON DesignState(VersionNumber);

-- Create a composite index for common queries
CREATE INDEX IX_DesignState_Template_Active ON DesignState(TemplateId, IsActive);

GO

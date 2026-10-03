using Microsoft.EntityFrameworkCore;
using TagIt.Api.Models;
using TagIt.Api.Models.Tenants;
using TagIt.Api.Models.Users;

namespace TagIt.Api.Data;

public class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<LabelTemplate> LabelTemplates => Set<LabelTemplate>();
    public DbSet<RolesLookUp> RolesLookUp => Set<RolesLookUp>();
    public DbSet<UserRole> UserRole => Set<UserRole>();
    public DbSet<DesignState> DesignState => Set<DesignState>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Comment> Comments => Set<Comment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Configure LabelTemplate
        modelBuilder.Entity<LabelTemplate>()
            .Property(t => t.JsonSchema)
            .HasColumnType("NVARCHAR(MAX)");
            
        // Configure UserRole composite primary key
        modelBuilder.Entity<UserRole>()
            .HasKey(ur => new { ur.UserId, ur.RoleId });

        // Configure UserRole relationships
        modelBuilder.Entity<UserRole>()
            .HasOne(ur => ur.User)
            .WithMany(u => u.UserRoles)
            .HasForeignKey(ur => ur.UserId)
            .OnDelete(DeleteBehavior.Restrict);
            
        modelBuilder.Entity<UserRole>()
            .HasOne(ur => ur.Role)
            .WithMany()
            .HasForeignKey(ur => ur.RoleId)
            .OnDelete(DeleteBehavior.Restrict);
            
        modelBuilder.Entity<UserRole>()
            .HasOne(ur => ur.AssignedByUser)
            .WithMany()
            .HasForeignKey(ur => ur.AssignedBy)
            .OnDelete(DeleteBehavior.Restrict);
            
        // Configure State relationships
        modelBuilder.Entity<DesignState>()
            .HasOne(ds => ds.Template)
            .WithMany()
            .HasForeignKey(ds => ds.TemplateId)
            .OnDelete(DeleteBehavior.Restrict);
            
        modelBuilder.Entity<DesignState>()
            .HasOne(ds => ds.Designer)
            .WithMany(u => u.DesignStates)
            .HasForeignKey(ds => ds.DesignerId)
            .OnDelete(DeleteBehavior.Restrict);
            
        modelBuilder.Entity<DesignState>()
            .HasOne(ds => ds.Reviewer)
            .WithMany(u => u.ReviewedStates)
            .HasForeignKey(ds => ds.ReviewerId)
            .OnDelete(DeleteBehavior.Restrict);
            
        modelBuilder.Entity<DesignState>()
            .HasOne(ds => ds.StateChangedByUser)
            .WithMany()
            .HasForeignKey(ds => ds.StateChangedBy)
            .OnDelete(DeleteBehavior.Restrict);
            
        modelBuilder.Entity<DesignState>()
            .HasOne(ds => ds.PublishedByUser)
            .WithMany(u => u.PublishedStates)
            .HasForeignKey(ds => ds.PublishedBy)
            .OnDelete(DeleteBehavior.Restrict);
            
        // Configure Comment
        modelBuilder.Entity<Comment>()
            .HasKey(c => c.CommentId);
            
        modelBuilder.Entity<Comment>()
            .Property(c => c.PositionX)
            .HasPrecision(10, 2);
            
        modelBuilder.Entity<Comment>()
            .Property(c => c.PositionY)
            .HasPrecision(10, 2);
            
        modelBuilder.Entity<Comment>()
            .Property(c => c.CommentText)
            .IsRequired();
            
        // Configure Comment relationships
        modelBuilder.Entity<Comment>()
            .HasOne(c => c.DesignState)
            .WithMany(ds => ds.CanvasComments)
            .HasForeignKey(c => c.DesignStateId)
            .OnDelete(DeleteBehavior.Cascade);
            
        modelBuilder.Entity<Comment>()
            .HasOne(c => c.CreatedByUser)
            .WithMany()
            .HasForeignKey(c => c.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);
            
        modelBuilder.Entity<Comment>()
            .HasOne(c => c.UpdatedByUser)
            .WithMany()
            .HasForeignKey(c => c.UpdatedBy)
            .OnDelete(DeleteBehavior.Restrict);
            
        modelBuilder.Entity<Comment>()
            .HasOne(c => c.ResolvedByUser)
            .WithMany()
            .HasForeignKey(c => c.ResolvedBy)
            .OnDelete(DeleteBehavior.Restrict);
            
        // Configure unique constraints
        modelBuilder.Entity<UserRole>()
            .HasIndex(ur => new { ur.UserId, ur.RoleId })
            .IsUnique();
            
        modelBuilder.Entity<DesignState>()
            .HasIndex(ds => new { ds.TemplateId, ds.VersionNumber })
            .IsUnique();


        // Configure Tenants
        modelBuilder.Entity<Tenant>(b =>
        {
            b.ToTable("Tenants");
            b.HasKey(x => x.TenantId);
            b.HasIndex(x => x.Domain).IsUnique();
            b.Property(x => x.Name).HasMaxLength(200).IsRequired();
            b.Property(x => x.Domain).HasMaxLength(255).IsRequired();
            b.Property(x => x.CreatedAt).HasColumnType("datetime2");
            b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
        });

        // Configure Users
        modelBuilder.Entity<User>(b =>
        {
            b.ToTable("Users");
            b.HasKey(x => x.UserId);
            b.Property(x => x.Email).HasMaxLength(255).IsRequired();
            b.Property(x => x.CreatedAt).HasColumnType("datetime2");
            b.Property(x => x.UpdatedAt).HasColumnType("datetime2");
            b.HasIndex(x => x.TenantId);
            b.HasIndex(x => x.Email);
            b.HasIndex(x => new { x.TenantId, x.Email }).IsUnique(); // matches UQ
            b.HasOne(x => x.Tenant)
             .WithMany()
             .HasForeignKey(x => x.TenantId)
             .OnDelete(DeleteBehavior.Restrict);
        });
    }
}

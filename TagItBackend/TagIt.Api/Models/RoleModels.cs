using System.ComponentModel.DataAnnotations;

namespace TagIt.Api.Models;

// Role DTOs
public class RoleDto
{
    public int RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public string? RoleDescription { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateRoleRequest
{
    [Required]
    [StringLength(50)]
    public string RoleName { get; set; } = string.Empty;
    
    [StringLength(200)]
    public string? RoleDescription { get; set; }
}

public class UpdateRoleRequest
{
    [Required]
    [StringLength(50)]
    public string RoleName { get; set; } = string.Empty;
    
    [StringLength(200)]
    public string? RoleDescription { get; set; }
}

// User Role DTOs
public class UserRoleDto
{
    public int UserId { get; set; }
    public int RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
}

public class AssignUserRoleRequest
{
    [Required]
    public int UserId { get; set; }
    
    [Required]
    public int RoleId { get; set; }
    
    public DateTime? ExpiresAt { get; set; }
    
    [Required]
    public int AssignedBy { get; set; }
}

// User DTOs
//public class UserDto
//{
//    public int UserId { get; set; }
//    public string Username { get; set; } = string.Empty;
//    public DateTime CreatedAt { get; set; }
//    public DateTime? UpdatedAt { get; set; }
//}

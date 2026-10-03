using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OfficeOpenXml;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Web;
using TagIt.Api.Data;
using TagIt.Api.Interfaces;
using TagIt.Api.Models;
using TagIt.Api.Providers;
using TagIt.Api.Providers.Tenants;
using TagIt.Api.Providers.Users;
using TagIt.Api.Services;
using TagIt.Api.Services.Tenants;
using TagIt.Api.Services.Users;
using TagIt.Api.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDb>(o =>
    o.UseSqlServer(builder.Configuration.GetConnectionString("Sql")));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp", policy =>
    {
        var allowedOrigins = new[]
        {
            "http://localhost:4200",
            "https://localhost:4200",
            "http://localhost:3000", // Alternative Angular port
            "https://localhost:3000"
        };
        
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required for SignalR with authentication
    });
});

// Add JWT Authentication
builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        var jwtSettings = builder.Configuration.GetSection("Authentication:Jwt");
        var secretKey = jwtSettings["SecretKey"];
        var issuer = jwtSettings["Issuer"];
        var audience = jwtSettings["Audience"];

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = issuer,
            ValidAudience = audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
            ClockSkew = TimeSpan.Zero // Remove default 5 minute clock skew
        };

        // Configure JWT for SignalR
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/collaborationHub"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

// Add Authorization
builder.Services.AddAuthorization();

builder.Services.AddScoped<ILabelPdfRenderer, LabelPdfRenderer>();
builder.Services.AddScoped<IFileParserService, FileParserService>();
builder.Services.AddScoped<ITemplateThumbnailService, TemplateThumbnailService>();

// Register new layered architecture services
// Providers (Data Access Layer)
builder.Services.AddScoped<IRoleProvider, RoleProvider>();
builder.Services.AddScoped<IDesignStateProvider, DesignStateProvider>();
builder.Services.AddScoped<IDashboardProvider, DashboardProvider>();
builder.Services.AddScoped<ITemplateProvider, TemplateProvider>();
builder.Services.AddScoped<ILabelProvider, LabelProvider>();
builder.Services.AddScoped<ITenantProvider, TenantProvider>();
builder.Services.AddScoped<IUserProvider, UserProvider>();
builder.Services.AddScoped<ICommentProvider, CommentProvider>();

// Services (Business Logic Layer)
builder.Services.AddScoped<IRoleService, RoleService>();
builder.Services.AddScoped<IDesignStateService, DesignStateService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IAuthorizationService, AuthorizationService>();
builder.Services.AddScoped<ITemplateService, TemplateService>();
builder.Services.AddScoped<ILabelService, LabelService>();
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<ICommentService, CommentService>();

// Add HttpContextAccessor for user context service
builder.Services.AddHttpContextAccessor();

// Add User Context Service
builder.Services.AddScoped<IUserContextService, UserContextService>();

// Add Collaboration Service
builder.Services.AddScoped<ICollaborationService, CollaborationService>();

// Add SignalR with increased message size limits
builder.Services.AddSignalR(options =>
{
    options.MaximumReceiveMessageSize = 10 * 1024 * 1024; // 10MB
    options.StreamBufferCapacity = 10;
    options.MaximumParallelInvocationsPerClient = 1;
    options.EnableDetailedErrors = true;
});

// Add Controllers
builder.Services.AddControllers();

// Configure file upload size limits
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 100_000_000; // 100MB limit
    options.ValueLengthLimit = int.MaxValue;
    options.ValueCountLimit = int.MaxValue;
    options.KeyLengthLimit = int.MaxValue;
});

// Set EPPlus license context for non-commercial use
ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Use CORS
app.UseCors("AllowAngularApp");

// Add Authentication and Authorization middleware
app.UseAuthentication();
app.UseAuthorization();

// Add Controllers
app.MapControllers();

// Map SignalR Hub
app.MapHub<CollaborationHub>("/collaborationHub");

// CSV-based PDF generation endpoint : Should migrate to LabelController
app.MapPost("/api/labels/generate-from-csv", async (HttpContext context, AppDb db, ILabelPdfRenderer renderer, IFileParserService fileParser) =>
{
    try
    {
        var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
        logger.LogInformation("Starting CSV-based PDF generation");

        // Validate request
        if (!context.Request.HasFormContentType)
        {
            return Results.BadRequest("Request must be multipart/form-data");
        }

        // Get template ID
        if (!context.Request.Form.TryGetValue("templateId", out var templateIdValue) || 
            !int.TryParse(templateIdValue, out int templateId))
        {
            return Results.BadRequest("Template ID is required and must be a valid integer");
        }

        logger.LogInformation($"Processing template ID: {templateId}");

        // Get CSV file
        var csvFile = context.Request.Form.Files.FirstOrDefault(f => f.Name == "csvFile");
        if (csvFile == null || csvFile.Length == 0)
        {
            return Results.BadRequest("CSV file is required");
        }

        logger.LogInformation($"Processing file: {csvFile.FileName}, Size: {csvFile.Length} bytes");

        // Get selected rows (optional)
        var selectedRows = new List<int>();
        if (context.Request.Form.TryGetValue("selectedRows", out var selectedRowsValue))
        {
            try
            {
                selectedRows = JsonSerializer.Deserialize<List<int>>(selectedRowsValue.ToString()) ?? new List<int>();
            }
            catch (JsonException ex)
            {
                logger.LogWarning($"Failed to parse selectedRows: {ex.Message}");
                selectedRows = new List<int>();
            }
        }

        logger.LogInformation($"Selected rows count: {selectedRows.Count}");

        // Parse the file based on extension
        var fileExtension = Path.GetExtension(csvFile.FileName).ToLowerInvariant();
        List<Dictionary<string, object>> dataRows;

        if (fileExtension == ".csv")
        {
            dataRows = await fileParser.ParseCsvFileAsync(csvFile, selectedRows);
        }
        else if (fileExtension == ".xlsx" || fileExtension == ".xls")
        {
            dataRows = await fileParser.ParseExcelFileAsync(csvFile, selectedRows);
        }
        else
        {
            return Results.BadRequest("Unsupported file format. Only CSV and Excel files are supported.");
        }

        logger.LogInformation($"Parsed {dataRows.Count} data rows");

        if (dataRows.Count == 0)
        {
            return Results.BadRequest("No data found in the file or no rows match the selection criteria");
        }

        // Get template
        var template = await db.LabelTemplates.FindAsync(templateId);
        if (template is null)
            return Results.NotFound($"Template {templateId} not found");

        // Generate PDF(s)
        if (dataRows.Count == 1)
        {
            // Generate single PDF
            var pdfBytes = renderer.RenderPdf(template.JsonSchema, dataRows[0]);
            logger.LogInformation("Generated single PDF");
            
            return Results.File(pdfBytes, "application/pdf", $"label-{DateTime.Now:yyyyMMdd-HHmmss}.pdf");
        }
        else
        {
            // Generate bulk PDFs and create ZIP
            using var zipStream = new MemoryStream();
            using (var archive = new System.IO.Compression.ZipArchive(zipStream, System.IO.Compression.ZipArchiveMode.Create, true))
            {
                for (int i = 0; i < dataRows.Count; i++)
                {
                    var dataRow = dataRows[i];
                    var pdfBytes = renderer.RenderPdf(template.JsonSchema, dataRow);
                    
                    var entry = archive.CreateEntry($"label_{i + 1}.pdf");
                    await using var entryStream = entry.Open();
                    await entryStream.WriteAsync(pdfBytes);
                }
            }

            zipStream.Position = 0;
            logger.LogInformation("Generated bulk PDFs and created ZIP");
            
            return Results.File(zipStream.ToArray(), "application/zip", $"bulk-labels-{DateTime.Now:yyyyMMdd-HHmmss}.zip");
        }
    }
    catch (Exception ex)
    {
        var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Error during CSV-based PDF generation");
        return Results.Problem($"Internal server error: {ex.Message}");
    }
});

app.Run();

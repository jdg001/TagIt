using TagIt.Api.Interfaces;
using TagIt.Api.Models;
using TagIt.Api.Providers;

namespace TagIt.Api.Services;

public class LabelService : ILabelService
{
    private readonly ILabelProvider _labelProvider;
    private readonly ILabelPdfRenderer _pdfRenderer;
    private readonly IFileParserService _fileParserService;
    private readonly ILogger<LabelService> _logger;

    public LabelService(
        ILabelProvider labelProvider,
        ILabelPdfRenderer pdfRenderer,
        IFileParserService fileParserService,
        ILogger<LabelService> logger)
    {
        _labelProvider = labelProvider;
        _pdfRenderer = pdfRenderer;
        _fileParserService = fileParserService;
        _logger = logger;
    }

    public async Task<byte[]> GenerateLabelAsync(GenerateLabelRequest request)
    {
        try
        {
            _logger.LogInformation("Generating single label for template ID: {TemplateId}", request.TemplateId);

            // Validate template exists
            var template = await _labelProvider.GetTemplateForGenerationAsync(request.TemplateId);
            if (template == null)
            {
                throw new InvalidOperationException($"Template {request.TemplateId} not found");
            }

            // Generate PDF
            var pdfBytes = _pdfRenderer.RenderPdf(template.JsonSchema, request.Data);
            
            _logger.LogInformation("Successfully generated label for template ID: {TemplateId}", request.TemplateId);
            return pdfBytes;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating label for template ID: {TemplateId}", request.TemplateId);
            throw;
        }
    }

    public async Task<byte[]> GenerateBulkLabelsAsync(BulkGenerateLabelRequest request)
    {
        try
        {
            _logger.LogInformation("Generating bulk labels for template ID: {TemplateId}, Count: {Count}", 
                request.TemplateId, request.DataSets?.Count ?? 0);

            // Validate template exists
            var template = await _labelProvider.GetTemplateForGenerationAsync(request.TemplateId);
            if (template == null)
            {
                throw new InvalidOperationException($"Template {request.TemplateId} not found");
            }

            // Validate data sets
            if (request.DataSets == null || request.DataSets.Count == 0)
            {
                throw new ArgumentException("No data sets provided");
            }

            // Generate ZIP with multiple PDFs
            using var zipStream = new MemoryStream();
            using (var archive = new System.IO.Compression.ZipArchive(zipStream, System.IO.Compression.ZipArchiveMode.Create, true))
            {
                for (int i = 0; i < request.DataSets.Count; i++)
                {
                    var data = request.DataSets[i];
                    var pdfBytes = _pdfRenderer.RenderPdf(template.JsonSchema, data);

                    var entry = archive.CreateEntry($"label-{request.TemplateId}-{i + 1}.pdf");
                    await using var entryStream = entry.Open();
                    await entryStream.WriteAsync(pdfBytes, 0, pdfBytes.Length);
                }
            }

            zipStream.Position = 0;
            var zipBytes = zipStream.ToArray();

            _logger.LogInformation("Successfully generated bulk labels for template ID: {TemplateId}, Count: {Count}", 
                request.TemplateId, request.DataSets.Count);
            return zipBytes;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating bulk labels for template ID: {TemplateId}", request.TemplateId);
            throw;
        }
    }

    public async Task<byte[]> GenerateLabelsFromFileAsync(int templateId, IFormFile file, List<int>? selectedRows = null)
    {
        try
        {
            _logger.LogInformation("Generating labels from file for template ID: {TemplateId}, File: {FileName}, Size: {FileSize} bytes", 
                templateId, file.FileName, file.Length);

            // Validate template exists
            var template = await _labelProvider.GetTemplateForGenerationAsync(templateId);
            if (template == null)
            {
                throw new InvalidOperationException($"Template {templateId} not found");
            }

            // Parse file based on extension
            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            List<Dictionary<string, object>> dataRows;

            if (fileExtension == ".csv")
            {
                dataRows = await _fileParserService.ParseCsvFileAsync(file, selectedRows);
            }
            else if (fileExtension == ".xlsx" || fileExtension == ".xls")
            {
                dataRows = await _fileParserService.ParseExcelFileAsync(file, selectedRows);
            }
            else
            {
                throw new ArgumentException("Unsupported file format. Only CSV and Excel files are supported.");
            }

            _logger.LogInformation("Parsed {RowCount} data rows from file", dataRows.Count);

            if (dataRows.Count == 0)
            {
                throw new InvalidOperationException("No data found in the file or no rows match the selection criteria");
            }

            // Generate PDF(s)
            if (dataRows.Count == 1)
            {
                // Generate single PDF
                var pdfBytes = _pdfRenderer.RenderPdf(template.JsonSchema, dataRows[0]);
                _logger.LogInformation("Generated single PDF from file");
                return pdfBytes;
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
                        var pdfBytes = _pdfRenderer.RenderPdf(template.JsonSchema, dataRow);
                        
                        var entry = archive.CreateEntry($"label_{i + 1}.pdf");
                        await using var entryStream = entry.Open();
                        await entryStream.WriteAsync(pdfBytes);
                    }
                }

                zipStream.Position = 0;
                var zipBytes = zipStream.ToArray();
                
                _logger.LogInformation("Generated bulk PDFs and created ZIP from file, Count: {Count}", dataRows.Count);
                return zipBytes;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating labels from file for template ID: {TemplateId}", templateId);
            throw;
        }
    }
}

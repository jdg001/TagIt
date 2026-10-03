using TagIt.Api.Models;

namespace TagIt.Api.Services;

public interface ILabelService
{
    /// <summary>
    /// Generate a single label PDF
    /// </summary>
    /// <param name="request">Label generation request</param>
    /// <returns>PDF bytes</returns>
    Task<byte[]> GenerateLabelAsync(GenerateLabelRequest request);

    /// <summary>
    /// Generate multiple labels and return as ZIP
    /// </summary>
    /// <param name="request">Bulk label generation request</param>
    /// <returns>ZIP file bytes containing multiple PDFs</returns>
    Task<byte[]> GenerateBulkLabelsAsync(BulkGenerateLabelRequest request);

    /// <summary>
    /// Generate labels from CSV/Excel file
    /// </summary>
    /// <param name="templateId">Template ID to use</param>
    /// <param name="file">CSV or Excel file</param>
    /// <param name="selectedRows">Optional selected rows to process</param>
    /// <returns>PDF bytes (single) or ZIP bytes (multiple)</returns>
    Task<byte[]> GenerateLabelsFromFileAsync(int templateId, IFormFile file, List<int>? selectedRows = null);
}

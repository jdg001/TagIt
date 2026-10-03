using Microsoft.AspNetCore.Http;
using CsvHelper;
using CsvHelper.Configuration;
using System.Globalization;
using OfficeOpenXml;
using System.Text.Json;

namespace TagIt.Api.Services;

public interface IFileParserService
{
    Task<List<Dictionary<string, object>>> ParseCsvFileAsync(IFormFile csvFile, List<int>? selectedRows = null);
    Task<List<Dictionary<string, object>>> ParseExcelFileAsync(IFormFile excelFile, List<int>? selectedRows = null);
}

public class FileParserService : IFileParserService
{
    private readonly ILogger<FileParserService> _logger;

    public FileParserService(ILogger<FileParserService> logger)
    {
        _logger = logger;
    }

    public async Task<List<Dictionary<string, object>>> ParseCsvFileAsync(IFormFile csvFile, List<int>? selectedRows = null)
    {
        var dataRows = new List<Dictionary<string, object>>();

        try
        {
            using var stream = csvFile.OpenReadStream();
            using var reader = new StreamReader(stream);
            using var csv = new CsvReader(reader, CultureInfo.InvariantCulture);

            // Read header
            await csv.ReadAsync();
            csv.ReadHeader();
            var headers = csv.HeaderRecord;

            _logger.LogInformation($"CSV Headers: {string.Join(", ", headers ?? Array.Empty<string>())}");

            int rowIndex = 0;
            while (await csv.ReadAsync())
            {
                // Skip row if not in selected rows (if selection was specified)
                if (selectedRows?.Count > 0 && !selectedRows.Contains(rowIndex))
                {
                    rowIndex++;
                    continue;
                }

                var row = new Dictionary<string, object>();
                foreach (var header in headers ?? Array.Empty<string>())
                {
                    var value = csv.GetField(header);
                    row[header] = value ?? string.Empty;
                }

                dataRows.Add(row);
                rowIndex++;
            }

            _logger.LogInformation($"Parsed {dataRows.Count} rows from CSV file");
            return dataRows;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing CSV file: {FileName}", csvFile.FileName);
            throw new InvalidOperationException($"Failed to parse CSV file: {ex.Message}", ex);
        }
    }

    public Task<List<Dictionary<string, object>>> ParseExcelFileAsync(IFormFile excelFile, List<int>? selectedRows = null)
    {
        var dataRows = new List<Dictionary<string, object>>();

        try
        {
            using var stream = excelFile.OpenReadStream();
            using var package = new ExcelPackage(stream);
            var worksheet = package.Workbook.Worksheets.FirstOrDefault();

            if (worksheet == null)
            {
                throw new InvalidOperationException("No worksheet found in Excel file");
            }

            var rowCount = worksheet.Dimension?.Rows ?? 0;
            var colCount = worksheet.Dimension?.Columns ?? 0;

        if (rowCount < 2) // Need at least header + 1 data row
        {
            _logger.LogWarning("Excel file has insufficient data rows");
            return Task.FromResult(dataRows);
        }

            // Read headers from first row
            var headers = new List<string>();
            for (int col = 1; col <= colCount; col++)
            {
                var headerValue = worksheet.Cells[1, col].Value?.ToString();
                headers.Add(headerValue ?? $"Column{col}");
            }

            _logger.LogInformation($"Excel Headers: {string.Join(", ", headers)}");

            // Read data rows
            int dataRowIndex = 0;
            for (int row = 2; row <= rowCount; row++)
            {
                // Skip row if not in selected rows (if selection was specified)
                if (selectedRows?.Count > 0 && !selectedRows.Contains(dataRowIndex))
                {
                    dataRowIndex++;
                    continue;
                }

                var dataRow = new Dictionary<string, object>();
                for (int col = 1; col <= colCount; col++)
                {
                    var cellValue = worksheet.Cells[row, col].Value?.ToString();
                    dataRow[headers[col - 1]] = cellValue ?? string.Empty;
                }

                dataRows.Add(dataRow);
                dataRowIndex++;
            }

            _logger.LogInformation($"Parsed {dataRows.Count} rows from Excel file");
            return Task.FromResult(dataRows);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing Excel file: {FileName}", excelFile.FileName);
            throw new InvalidOperationException($"Failed to parse Excel file: {ex.Message}", ex);
        }
    }
}

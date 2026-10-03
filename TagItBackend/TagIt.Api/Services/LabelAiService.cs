using System.Text.Json;
using TagIt.Api.Models;

namespace TagIt.Api.Services;
public class LabelAiService : ILabelAiService
{
    private readonly IAiService _geminiService;

    public LabelAiService(IAiService geminiService)
    {
        _geminiService = geminiService;
    }

    public async Task<LabelSchema> ExtractTemplateAsync(byte[] imageBytes)
    {
        if (imageBytes == null || imageBytes.Length == 0)
            return new LabelSchema { Paper = new PaperDef { Width = 6, Height = 6 } };

        var prompt = @"
You are a label designer AI.
Input: image of a label template
Output: JSON ONLY matching LabelSchema model.
Rules:
- Elements: text, textarea, barcode, qr, image, rectangle, line.
- Barcodes/QR/images: placeholders only.
- Positions/sizes: approximate relative to paper.
- Return valid JSON ONLY; no extra text.";

        string aiResponse;
        try
        {
            aiResponse = await _geminiService.GenerateContentAsync(prompt, imageBytes);
        }
        catch
        {
            return new LabelSchema { Paper = new PaperDef { Width = 6, Height = 6 } };
        }

        return ParseAiJson(aiResponse);
    }

    public async Task<LabelSchema> GenerateFromPromptAsync(LabelPromptRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var fixedPaper = new PaperDef { Width = request.Width, Height = request.Height, Unit = "inch" };

        var prompt = $@"
You are a label designer AI.
Input: {request.Prompt}
Output: JSON ONLY matching LabelSchema model.
Rules:
- Paper: Width={fixedPaper.Width}, Height={fixedPaper.Height}, Unit='inch'.
- Elements: text, textarea, barcode, qr, image, rectangle, line.
- Barcodes/QR/images: placeholders only.
- Positions/sizes: approximate relative to paper.
- Return valid JSON ONLY; no extra text.";

        string aiResponse;
        try
        {
            aiResponse = await _geminiService.GenerateContentAsync(prompt, Array.Empty<byte>());
        }
        catch
        {
            return new LabelSchema { Paper = fixedPaper };
        }

        var schema = ParseAiJson(aiResponse);
        schema.Paper = fixedPaper;
        return schema;
    }

    private LabelSchema ParseAiJson(string aiResponse)
    {
        try
        {
            using var doc = JsonDocument.Parse(aiResponse);
            var text = doc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();

            var schema = JsonSerializer.Deserialize<LabelSchema>(text ?? "");
            return schema ?? new LabelSchema { Paper = new PaperDef { Width = 6, Height = 6 } };
        }
        catch
        {
            return new LabelSchema { Paper = new PaperDef { Width = 6, Height = 6 } };
        }
    }
}

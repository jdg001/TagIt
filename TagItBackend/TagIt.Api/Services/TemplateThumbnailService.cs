using TagIt.Api.Interfaces;
using TagIt.Api.Models;
using System.Text.Json;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using TagIt.Api.Data;

namespace TagIt.Api.Services;

public class TemplateThumbnailService : ITemplateThumbnailService
{
    private readonly AppDb _db;
    private readonly ILabelPdfRenderer _pdfRenderer;

    public TemplateThumbnailService(AppDb db, ILabelPdfRenderer pdfRenderer)
    {
        _db = db;
        _pdfRenderer = pdfRenderer;
    }

    public byte[] GenerateThumbnail(LabelTemplate template, int width = 200, int height = 200)
    {
        try
        {
                // Parse the JSON schema to get template elements
                var schema = LabelSchemaParser.ParseSchema(template.JsonSchema);
            
            if (schema == null || schema.Elements == null || !schema.Elements.Any())
            {
                return GenerateEmptyThumbnail(width, height);
            }

            // Calculate thumbnail dimensions maintaining aspect ratio
            var paperWidth = (double)template.PaperWidth;
            var paperHeight = (double)template.PaperHeight;
            var aspectRatio = paperWidth / paperHeight;

            int thumbnailWidth, thumbnailHeight;
            if (aspectRatio > 1) // Landscape
            {
                thumbnailWidth = width;
                thumbnailHeight = (int)(width / aspectRatio);
            }
            else // Portrait or square
            {
                thumbnailHeight = height;
                thumbnailWidth = (int)(height * aspectRatio);
            }

            // Create bitmap for thumbnail
            using var bitmap = new Bitmap(thumbnailWidth, thumbnailHeight);
            using var graphics = Graphics.FromImage(bitmap);
            
            // Set high quality rendering
            graphics.SmoothingMode = SmoothingMode.AntiAlias;
            graphics.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAlias;
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;

            // Fill background with white
            graphics.Clear(Color.White);

            // Calculate scaling factor from paper size to thumbnail size
            var scaleX = thumbnailWidth / paperWidth;
            var scaleY = thumbnailHeight / paperHeight;
            var scale = Math.Min(scaleX, scaleY); // Use uniform scaling

            // Render each element
            Console.WriteLine($"Template {template.TemplateId}: Rendering {schema.Elements.Count} elements with scale {scale}");
            foreach (var element in schema.Elements)
            {
                Console.WriteLine($"Template {template.TemplateId}: Rendering element {element.Id} of type {element.Type} at ({element.X}, {element.Y}) size ({element.W}, {element.H})");
                RenderElement(graphics, element, scale, paperWidth, paperHeight, thumbnailWidth, thumbnailHeight);
            }

            // Convert to PNG byte array
            using var memoryStream = new MemoryStream();
            bitmap.Save(memoryStream, ImageFormat.Png);
            return memoryStream.ToArray();
        }
        catch (Exception ex)
        {
            // Log error and return empty thumbnail
            Console.WriteLine($"Error generating thumbnail for template {template.TemplateId}: {ex.Message}");
            return GenerateEmptyThumbnail(width, height);
        }
    }

    public async Task<byte[]> GenerateThumbnailAsync(int templateId, int width = 200, int height = 200)
    {
        var template = await _db.LabelTemplates.FindAsync(templateId);
        if (template == null)
        {
            return GenerateEmptyThumbnail(width, height);
        }

        return GenerateThumbnail(template, width, height);
    }

    private void RenderElement(Graphics graphics, Element element, double scale, 
        double paperWidth, double paperHeight, int thumbnailWidth, int thumbnailHeight)
    {
        try
        {
            // Convert element coordinates from pixels to inches, then to thumbnail coordinates
            // Assuming 96 DPI (standard Windows DPI)
            const double dpi = 96.0;
            var xInches = element.X / dpi;
            var yInches = element.Y / dpi;
            var widthInches = element.W / dpi;
            var heightInches = element.H / dpi;
            
            // Convert to thumbnail coordinates
            var x = (float)(xInches * scale);
            var y = (float)(yInches * scale);
            var width = (float)(widthInches * scale);
            var height = (float)(heightInches * scale);

            // Ensure minimum size for visibility
            if (width < 1) width = 1;
            if (height < 1) height = 1;

            switch (element.Type.ToLower())
            {
                case "text":
                    RenderTextElement(graphics, (TextElement)element, x, y, width, height, scale);
                    break;
                case "textarea":
                    RenderTextareaElement(graphics, (TextareaElement)element, x, y, width, height, scale);
                    break;
                case "barcode":
                    RenderBarcodeElement(graphics, (BarcodeElement)element, x, y, width, height, scale);
                    break;
                case "qr":
                    RenderQrElement(graphics, (QrElement)element, x, y, width, height, scale);
                    break;
                case "rectangle":
                    RenderRectElement(graphics, (RectElement)element, x, y, width, height, scale);
                    break;
                case "image":
                    RenderImageElement(graphics, (ImageElement)element, x, y, width, height, scale);
                    break;
                case "line":
                    RenderLineElement(graphics, (LineElement)element, x, y, width, height, scale);
                    break;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error rendering element {element.Id}: {ex.Message}");
        }
    }

    private void RenderTextElement(Graphics graphics, TextElement element, float x, float y, float width, float height, double scale)
    {
        if (string.IsNullOrEmpty(element.Value)) return;

        var fontSize = 8;
        var fontFamily = new FontFamily(element.Style.FontFamily ?? "Arial");
        var fontStyle = element.Style.Bold ? FontStyle.Bold : FontStyle.Regular;
        
        using var font = new Font(fontFamily, fontSize, fontStyle);
        using var brush = new SolidBrush(ParseColor(element.Style.Color));
        
        var rect = new RectangleF(x, y, width, height);
        var format = new StringFormat();
        
        switch (element.Style.Align.ToLower())
        {
            case "center":
                format.Alignment = StringAlignment.Center;
                break;
            case "right":
                format.Alignment = StringAlignment.Far;
                break;
            default:
                format.Alignment = StringAlignment.Near;
                break;
        }
        
        format.LineAlignment = StringAlignment.Center;
        format.Trimming = StringTrimming.EllipsisWord;
        format.FormatFlags = StringFormatFlags.NoWrap;

        graphics.DrawString(element.Value, font, brush, rect, format);
    }

    private void RenderTextareaElement(Graphics graphics, TextareaElement element, float x, float y, float width, float height, double scale)
    {
        // Similar to text element but with multi-line support
        RenderTextElement(graphics, new TextElement 
        { 
            Value = element.Value, 
            Style = element.Style 
        }, x, y, width, height, scale);
    }

    private static void RenderBarcodeElement(Graphics graphics, BarcodeElement element, float x, float y, float width, float height, double scale)
    {
        // Draw a simple barcode representation
        using var brush = new SolidBrush(Color.Black);
        using var pen = new Pen(Color.Black, 1);
        
        // Draw barcode lines (simplified representation)
        var lineCount = Math.Max(10, (int)(width / 2));
        var lineWidth = width / lineCount;
        
        var random = new Random(element.Id.GetHashCode());
        for (int i = 0; i < lineCount; i++)
        {
            var lineHeight = height * (0.3f + (float)random.NextDouble() * 0.7f);
            var lineX = x + i * lineWidth;
            var lineY = y + (height - lineHeight) / 2;
            
            graphics.FillRectangle(brush, lineX, lineY, lineWidth * 0.8f, lineHeight);
        }
        
        // Draw border
        graphics.DrawRectangle(pen, x, y, width, height);
    }

    private static void RenderQrElement(Graphics graphics, QrElement element, float x, float y, float width, float height, double scale)
    {
        // Draw a simple QR code representation
        using var brush = new SolidBrush(Color.Black);
        using var pen = new Pen(Color.Black, 1);
        
        // Draw QR code pattern (simplified)
        var cellSize = Math.Min(width, height) / 10;
        var random = new Random(element.Id.GetHashCode());
        
        for (int row = 0; row < 10; row++)
        {
            for (int col = 0; col < 10; col++)
            {
                if (random.NextDouble() > 0.5)
                {
                    var cellX = x + col * cellSize;
                    var cellY = y + row * cellSize;
                    graphics.FillRectangle(brush, cellX, cellY, cellSize, cellSize);
                }
            }
        }
        
        // Draw border
        graphics.DrawRectangle(pen, x, y, width, height);
    }

    private void RenderRectElement(Graphics graphics, RectElement element, float x, float y, float width, float height, double scale)
    {   
        // Border thickness should not be scaled - keep it at a reasonable size
        var borderThickness = Math.Max(1, Math.Min(3, (float)element.BorderThickness));
        using var pen = new Pen(ParseColor(element.Color), borderThickness);
        
        if (element.FillColor != null && element.FillColor != "transparent")
        {
            using var brush = new SolidBrush(ParseColor(element.FillColor));
            graphics.FillRectangle(brush, x, y, width, height);
        }
        
        graphics.DrawRectangle(pen, x, y, width, height);
    }

    private void RenderLineElement(Graphics graphics, LineElement element, float x, float y, float width, float height, double scale)
    {
        // Line thickness (not scaled too thin or too thick)
        var thickness = Math.Max(1, Math.Min(5, (float)element.Thickness));
        using var pen = new Pen(ParseColor(element.Color), thickness);

        // Draw line from top-left to bottom-right of bounding box
        graphics.DrawLine(pen, x, y, x + width, y + height);
    }

    private static void RenderImageElement(Graphics graphics, ImageElement element, float x, float y, float width, float height, double scale)
    {
        // For now, draw a placeholder for images
        using var brush = new SolidBrush(Color.LightGray);
        using var pen = new Pen(Color.Gray, 1);
        
        graphics.FillRectangle(brush, x, y, width, height);
        graphics.DrawRectangle(pen, x, y, width, height);
        
        // Draw "IMG" text
        using var font = new Font("Arial", Math.Max(8, (float)(12 * scale)), FontStyle.Regular);
        using var textBrush = new SolidBrush(Color.Gray);
        var textRect = new RectangleF(x, y, width, height);
        var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        graphics.DrawString("IMG", font, textBrush, textRect, format);
    }

    private static Color ParseColor(string colorString)
    {
        if (string.IsNullOrEmpty(colorString) || colorString == "transparent")
            return Color.Transparent;
            
        try
        {
            if (colorString.StartsWith("#"))
            {
                var hex = colorString.Substring(1);
                if (hex.Length == 6)
                {
                    var r = Convert.ToInt32(hex.Substring(0, 2), 16);
                    var g = Convert.ToInt32(hex.Substring(2, 2), 16);
                    var b = Convert.ToInt32(hex.Substring(4, 2), 16);
                    return Color.FromArgb(r, g, b);
                }
            }
        }
        catch
        {
            // Fall through to default
        }
        
        return Color.Black; // Default color
    }

    private static byte[] GenerateEmptyThumbnail(int width, int height)
    {
        using var bitmap = new Bitmap(width, height);
        using var graphics = Graphics.FromImage(bitmap);
        using var memoryStream = new MemoryStream();
        
        // Fill with light gray background
        graphics.Clear(Color.LightGray);
        
        // Draw a simple placeholder
        using var pen = new Pen(Color.Gray, 2);
        using var brush = new SolidBrush(Color.Gray);
        using var font = new Font("Arial", 12, FontStyle.Regular);
        
        var rect = new Rectangle(10, 10, width - 20, height - 20);
        graphics.DrawRectangle(pen, rect);
        
        var textRect = new RectangleF(0, 0, width, height);
        var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        graphics.DrawString("Empty Template", font, brush, textRect, format);
        
        bitmap.Save(memoryStream, ImageFormat.Png);
        return memoryStream.ToArray();
    }
}

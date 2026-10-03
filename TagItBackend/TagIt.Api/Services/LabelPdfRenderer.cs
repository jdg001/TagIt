using SkiaSharp;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using TagIt.Api.Interfaces;
using TagIt.Api.Models;
using ZXing;
using ZXing.SkiaSharp.Rendering;

namespace TagIt.Api.Services;

public class LabelPdfRenderer : ILabelPdfRenderer
{
    public byte[] RenderPdf(string jsonSchema, IDictionary<string, object> data)
    {
        var schema = LabelSchemaParser.ParseSchema(jsonSchema);

        var (pageWidthPt, pageHeightPt) = ToPoints(schema.Paper.Width, schema.Paper.Height, schema.Paper.Unit, 96); // DPI : 96

        using var ms = new MemoryStream();
        using var document = SKDocument.CreatePdf(ms);
        using var canvas = document.BeginPage((float)pageWidthPt, (float)pageHeightPt);

        // White background
        canvas.Clear(SKColors.White);

        foreach (var el in schema.Elements)
        {
            var (xPt, yPt, wPt, hPt) = ToRectPoints(el, schema.Paper);

            switch (el.Type.ToLowerInvariant())
            {
                case "text":
                    {
                        var t = (TextElement)el;
                        var text = ResolveTokens(t.Value, data);

                        using var paint = new SKPaint
                        {
                            IsAntialias = true,
                            Typeface = SKTypeface.FromFamilyName(
                                t.Style.FontFamily,
                                t.Style.Bold ? SKFontStyle.Bold : SKFontStyle.Normal),
                            TextSize = t.Style.FontSize,
                            Color = ParseColor(t.Style.Color)
                        };

                        paint.TextAlign = t.Style.Align switch
                        {
                            "center" => SKTextAlign.Center,
                            "right" => SKTextAlign.Right,
                            _ => SKTextAlign.Left
                        };

                        // Handle text wrapping for long text
                        var lines = WrapText(text, paint, (float)wPt);
                        float lineHeight = t.Style.FontSize * 1.2f; // Line spacing
                        
                        for (int i = 0; i < lines.Length; i++)
                        {
                            var line = lines[i];
                            float lineY = (float)(yPt + t.Style.FontSize + 2 + (i * lineHeight));
                            
                            // Check if line fits within the element height
                            if (lineY > yPt + hPt) break;
                            
                            float tx = (float)xPt;
                            if (t.Style.Align == "center") tx = (float)(xPt + wPt / 2);
                            else if (t.Style.Align == "right") tx = (float)(xPt + wPt);

                            canvas.DrawText(line, tx, lineY, paint);
                        }
                        break;
                    }

                case "textarea":
                    {
                        var t = (TextareaElement)el;
                        var text = ResolveTokens(t.Value, data);

                        using var paint = new SKPaint
                        {
                            IsAntialias = true,
                            Typeface = SKTypeface.FromFamilyName(
                                t.Style.FontFamily,
                                t.Style.Bold ? SKFontStyle.Bold : SKFontStyle.Normal),
                            TextSize = t.Style.FontSize,
                            Color = ParseColor(t.Style.Color)
                        };

                        // Textarea has transparent background, no background or border drawing needed

                        // Handle multi-line textarea content
                        // First split by actual line breaks, then wrap each line if needed
                        var originalLines = text.Split(new[] { "\r\n", "\n", "\r" }, StringSplitOptions.None);
                        var allLines = new List<string>();
                        
                        foreach (var originalLine in originalLines)
                        {
                            // Apply word wrapping to each original line
                            var wrappedLines = WrapText(originalLine, paint, (float)wPt);
                            allLines.AddRange(wrappedLines);
                        }
                        
                        float lineHeight = t.Style.FontSize * 1.2f; // Line spacing
                        
                        for (int i = 0; i < allLines.Count; i++)
                        {
                            var line = allLines[i];
                            float lineY = (float)(yPt + t.Style.FontSize + (i * lineHeight));
                            
                            // Check if line fits within the textarea height
                            if (lineY > yPt + hPt) break;
                            
                            canvas.DrawText(line, (float)xPt, lineY, paint);
                        }
                        break;
                    }

                case "barcode":
                    {
                        var b = (BarcodeElement)el;
                        var value = ResolveTokens(b.Data, data);
                        if (string.IsNullOrWhiteSpace(value)) break;

                        var format = b.Format.ToUpperInvariant() switch
                        {
                            "EAN13" => BarcodeFormat.EAN_13,
                            "CODE39" => BarcodeFormat.CODE_39,
                            _ => BarcodeFormat.CODE_128
                        };

                        var writer = new BarcodeWriter<SKBitmap>
                        {
                            Format = format,
                            Options = new ZXing.Common.EncodingOptions
                            {
                                Width = Math.Max(2, (int)wPt),
                                Height = Math.Max(2, (int)hPt),
                                Margin = 0
                            },
                            Renderer = new SKBitmapRenderer()
                        };

                        using var bmp = writer.Write(value);
                        using var img = SKImage.FromBitmap(bmp);

                        canvas.DrawImage(img, new SKRect(
                            (float)xPt, (float)yPt, (float)(xPt + wPt), (float)(yPt + hPt)));

                        if (b.HumanReadable)
                        {
                            using var paint = new SKPaint { Color = SKColors.Black, TextSize = 10, IsAntialias = true };
                            canvas.DrawText(value, (float)xPt, (float)(yPt + hPt + 12), paint);
                        }
                        break;
                    }

                case "qr":
                    {
                        var q = (QrElement)el;
                        var value = ResolveTokens(q.Data, data);
                        if (string.IsNullOrWhiteSpace(value)) break;

                        var ecc = q.ErrorCorrection.ToUpperInvariant() switch
                        {
                            "L" => ZXing.QrCode.Internal.ErrorCorrectionLevel.L,
                            "Q" => ZXing.QrCode.Internal.ErrorCorrectionLevel.Q,
                            "H" => ZXing.QrCode.Internal.ErrorCorrectionLevel.H,
                            _ => ZXing.QrCode.Internal.ErrorCorrectionLevel.M
                        };

                        // Use BarcodeWriter for QR codes to ensure proper sizing (same approach as barcodes)
                        var writer = new BarcodeWriter<SKBitmap>
                        {
                            Format = BarcodeFormat.QR_CODE,
                            Options = new ZXing.Common.EncodingOptions
                            {
                                Width = Math.Max(2, (int)wPt),
                                Height = Math.Max(2, (int)hPt),
                                Margin = 0
                            },
                            Renderer = new SKBitmapRenderer()
                        };
                        
                        // Set error correction level using hints
                        writer.Options.Hints[EncodeHintType.ERROR_CORRECTION] = ecc;

                        using var bmp = writer.Write(value);
                        using var img = SKImage.FromBitmap(bmp);

                        canvas.DrawImage(img, new SKRect(
                            (float)xPt, (float)yPt, (float)(xPt + wPt), (float)(yPt + hPt)));
                        break;
                    }

                case "image":
                    {
                        var i = (ImageElement)el;
                        var src = ResolveTokens(i.Src, data);
                        using var img = LoadImage(src);
                        if (img != null)
                        {
                            canvas.DrawImage(img, new SKRect(
                                (float)xPt, (float)yPt, (float)(xPt + wPt), (float)(yPt + hPt)));
                        }
                        break;
                    }

                case "rectangle":
                    {
                        var r = (RectElement)el;
                        var rect = new SKRect(
                            (float)xPt, (float)yPt, (float)(xPt + wPt), (float)(yPt + hPt));
                        
                        // Draw fill first if fill color is not transparent
                        if (!string.IsNullOrEmpty(r.FillColor) && r.FillColor.ToLower() != "transparent")
                        {
                            using var fillPaint = new SKPaint
                            {
                                Style = SKPaintStyle.Fill,
                                Color = ParseColor(r.FillColor)
                            };
                            canvas.DrawRect(rect, fillPaint);
                        }
                        
                        // Draw border if border thickness > 0
                        if (r.BorderThickness > 0)
                        {
                            using var borderPaint = new SKPaint
                            {
                                Style = SKPaintStyle.Stroke,
                                StrokeWidth = Math.Max(0.5f, r.BorderThickness),
                                Color = ParseColor(r.Color)
                            };
                            canvas.DrawRect(rect, borderPaint);
                        }
                        break;
                    }

                case "line":
                    {
                        var l = (LineElement)el;

                        // interpret H as thickness if Thickness not set
                        var thickness = l.Thickness > 0 ? l.Thickness : 0.5f; // inches->pt

                        // convert start/end in points
                        var (xLinePt, yLinePt, wLinePt, hLinePt) = ToRectPoints(l, schema.Paper);

                        using var paint = new SKPaint
                        {
                            Style = SKPaintStyle.Stroke,
                            StrokeWidth = thickness,
                            Color = ParseColor(l.Color),
                            IsAntialias = false
                        };

                        // Handle different line orientations
                        if (l.Angle == 90f)
                        {
                            // Vertical line from (x, y) to (x, y+h)
                            canvas.DrawLine((float)xLinePt, (float)yLinePt, (float)xLinePt, (float)(yLinePt + hLinePt), paint);
                        }
                        else
                        {
                            // Horizontal line from (x, y) to (x+w, y) - default behavior
                            canvas.DrawLine((float)xLinePt, (float)yLinePt, (float)(xLinePt + wLinePt), (float)yLinePt, paint);
                        }
                        break;
                    }
            }
        }

        document.EndPage();
        document.Close();
        return ms.ToArray();
    }

    // ---------- helpers ----------
    private static (double widthPt, double heightPt) ToPoints(
        double w, double h, string unit, int dpi) => unit.ToLower() switch
        {
            "mm" => (w * 72.0 / 25.4, h * 72.0 / 25.4),
            "px" => (w * 72.0 / dpi, h * 72.0 / dpi),
            _ => (w * 72.0, h * 72.0) // inch
        };

    private static (double x, double y, double w, double h) ToRectPoints(Element el, PaperDef paper)
    {
        // Detect coordinate mismatch: if unit is "inch" but coordinates are clearly pixels
        var paperWidthPx = paper.Unit.ToLower() == "inch" ? paper.Width * 96 : paper.Width;
        var paperHeightPx = paper.Unit.ToLower() == "inch" ? paper.Height * 96 : paper.Height;
        
        bool isCoordinateMismatch = el.Unit.ToLower() == "inch" && 
                                   (el.X > paperWidthPx * 0.5 || el.Y > paperHeightPx * 0.5);
        
        string actualUnit = isCoordinateMismatch ? "px" : el.Unit;
        
        
        (double x, double y) = Convert(el.X, el.Y, actualUnit, 96); // DPI : 96
        (double w, double h) = Convert(el.W, el.H, actualUnit, 96); // DPI : 96
        return (x, y, w, h);

        static (double, double) Convert(double a, double b, string unit, int dpi) => unit.ToLower() switch
        {
            "mm" => (a * 72.0 / 25.4, b * 72.0 / 25.4),
            "px" => (a * 72.0 / dpi, b * 72.0 / dpi),
            _ => (a * 72.0, b * 72.0) // inch
        };
    }

    private static string ResolveTokens(string input, IDictionary<string, object> data)
        => Regex.Replace(input ?? "", "{{(.*?)}}", m =>
        {
            var key = m.Groups[1].Value.Trim();
            return data.TryGetValue(key, out var v) ? Convert.ToString(v) ?? "" : "";
        });

    private static SKColor ParseColor(string hex)
    {
        if (string.IsNullOrWhiteSpace(hex)) return SKColors.Black;
        if (hex.StartsWith("#")) hex = hex[1..];
        return uint.TryParse(hex, System.Globalization.NumberStyles.HexNumber, null, out var rgb)
            ? new SKColor((byte)((rgb >> 16) & 0xFF), (byte)((rgb >> 8) & 0xFF), (byte)(rgb & 0xFF))
            : SKColors.Black;
    }

    private static SKImage? LoadImage(string src)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(src)) return null;

            // base64:data:image/png;base64,XXXX
            if (src.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            {
                var comma = src.IndexOf(',');
                if (comma > 0)
                {
                    var b64 = src[(comma + 1)..];
                    var bytes = Convert.FromBase64String(b64);
                    return SKImage.FromEncodedData(bytes);
                }
            }

            // simple file path or absolute URL (optional – uncomment file path support if needed)
            // if (File.Exists(src)) return SKImage.FromEncodedData(File.ReadAllBytes(src));

            // Remote URL fetch is intentionally not implemented for security; you could add HttpClient here.
            return null;
        }
        catch { return null; }
    }


    private static string[] WrapText(string text, SKPaint paint, float maxWidth)
    {
        if (string.IsNullOrWhiteSpace(text)) return new[] { "" };
        
        var words = text.Split(' ');
        var lines = new List<string>();
        var currentLine = "";
        
        foreach (var word in words)
        {
            var testLine = string.IsNullOrEmpty(currentLine) ? word : currentLine + " " + word;
            var bounds = new SKRect();
            paint.MeasureText(testLine, ref bounds);
            
            if (bounds.Width <= maxWidth)
            {
                currentLine = testLine;
            }
            else
            {
                if (!string.IsNullOrEmpty(currentLine))
                {
                    lines.Add(currentLine);
                    currentLine = word;
                }
                else
                {
                    // Single word is too long, add it anyway
                    lines.Add(word);
                    currentLine = "";
                }
            }
        }
        
        if (!string.IsNullOrEmpty(currentLine))
        {
            lines.Add(currentLine);
        }
        
        return lines.ToArray();
    }
}

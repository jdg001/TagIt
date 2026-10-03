using System.Text.Json.Serialization;
using System.Xml.Linq;

namespace TagIt.Api.Models;

public class LabelSchema
{
    public PaperDef Paper { get; set; } = new();
    
    public List<Element> Elements { get; set; } = [];
    
    // Additional properties that might be in the JSON
    public List<Element>? OriginalElements { get; set; }
    public PaperLayout? PaperLayout { get; set; }
    public int? CanvasWidth { get; set; }
    public int? CanvasHeight { get; set; }
    public string? PaperSize { get; set; }
    public string? Created { get; set; }
}

public class PaperLayout
{
    public double Left { get; set; }
    public double Top { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
}

public class PaperDef
{
    public string Unit { get; set; } = "inch";  // inch | mm | px
    public double Width { get; set; } = 4;
    public double Height { get; set; } = 6;
    //public int Dpi { get; set; } = 203;         // used if unit==px conversion needed
}

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(TextElement), "text")]
[JsonDerivedType(typeof(TextareaElement), "textarea")]
[JsonDerivedType(typeof(BarcodeElement), "barcode")]
[JsonDerivedType(typeof(QrElement), "qr")]
[JsonDerivedType(typeof(ImageElement), "image")]
[JsonDerivedType(typeof(RectElement), "rectangle")]
public abstract class Element
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Type { get; set; } = "text";  // text|barcode|qr|image|rect|line
    public double X { get; set; }
    public double Y { get; set; }
    
    [JsonPropertyName("w")]
    public double W { get; set; }
    
    [JsonPropertyName("h")]
    public double H { get; set; }
    
    public string Unit { get; set; } = "inch";  // inherit paper units typically
}

public class TextStyleDef
{
    public string FontFamily { get; set; } = "Arial";
    public float FontSize { get; set; } = 12;
    public bool Bold { get; set; }
    public string Align { get; set; } = "left"; // left|center|right
    public string Color { get; set; } = "#000000"; // Text color
}

public sealed class TextElement : Element
{
    public string Value { get; set; } = "";
    public TextStyleDef Style { get; set; } = new();
}

public sealed class TextareaElement : Element
{
    public string Value { get; set; } = "";
    public TextStyleDef Style { get; set; } = new();
    public int Rows { get; set; } = 4;
    public int Cols { get; set; } = 20;
    public string Placeholder { get; set; } = "";
}

public sealed class BarcodeElement : Element
{
    public string Format { get; set; } = "CODE128"; // CODE128|EAN13|CODE39
    public string Data { get; set; } = "";
    public double QuietZone { get; set; } = 0.05;   // same Unit as element
    public bool HumanReadable { get; set; } = false;
}

public sealed class QrElement : Element
{
    public string Data { get; set; } = "";
    public string ErrorCorrection { get; set; } = "M"; // L|M|Q|H
}

public sealed class ImageElement : Element
{
    public string Src { get; set; } = ""; // URL/base64/token
}

public sealed class RectElement : Element
{
    [JsonPropertyName("borderThickness")]
    public float BorderThickness { get; set; } = 1f; // points
    
    [JsonPropertyName("color")]
    public string Color { get; set; } = "#000000"; // Border color
    
    [JsonPropertyName("fillColor")]
    public string FillColor { get; set; } = "#ffffff"; // Fill color
}

public sealed class LineElement : Element
{
    // optional explicit thickness; if 0 we'll use H as thickness
    public float Thickness { get; set; } = 1f;
    public string Color { get; set; } = "#000000";
    public float Angle { get; set; } = 0f; // 0 = horizontal, 90 = vertical
}

using System.Text.Json;
using System.Text.Json.Nodes;
using TagIt.Api.Models;

namespace TagIt.Api.Services;

public static class LabelSchemaParser
{
    public static LabelSchema ParseSchema(string json)
    {
        var root = JsonNode.Parse(json)!.AsObject();

        var paper = root["paper"]?.Deserialize<PaperDef>(new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? new PaperDef();

        var elements = new List<Element>();
        foreach (var node in root["elements"]!.AsArray())
        {
            var type = node!["type"]!.GetValue<string>().ToLowerInvariant();

            Element el = type switch
            {
                "text" => node.Deserialize<TextElement>(JsonOpt())!,
                "textarea" => node.Deserialize<TextareaElement>(JsonOpt())!,
                "barcode" => node.Deserialize<BarcodeElement>(JsonOpt())!,
                "qr" => node.Deserialize<QrElement>(JsonOpt())!,
                "image" => node.Deserialize<ImageElement>(JsonOpt())!,
                "rectangle" => node.Deserialize<RectElement>(JsonOpt())!,
                "line" => node.Deserialize<LineElement>(JsonOpt())!,
                _ => throw new InvalidOperationException($"Unknown element type: {type}")
            };

            elements.Add(el);
        }

        return new LabelSchema { Paper = paper, Elements = elements };

        static JsonSerializerOptions JsonOpt() => new() { PropertyNameCaseInsensitive = true };
    }
}

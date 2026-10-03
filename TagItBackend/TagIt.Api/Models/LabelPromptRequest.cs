namespace TagIt.Api.Models;
public class LabelPromptRequest
{
    public string Prompt { get; set; } = "";
    public int Width { get; set; } = 6;   // default 4 inch
    public int Height { get; set; } = 6;  // default 6 inch
}

public class LabelImageRequest
{
    public byte[] ImageBase64 { get; set; } = Array.Empty<byte>();
}

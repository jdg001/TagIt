using Microsoft.AspNetCore.Mvc;
using System.Text;
using TagIt.Api.Models;
using TagIt.Api.Services;

namespace TagIt.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LabelAiController : ControllerBase
{
    private readonly ILabelAiService _labelAiService;

    public LabelAiController(ILabelAiService labelAiService)
    {
        _labelAiService = labelAiService;
    }

    [HttpPost("extract-template")]
    public async Task<IActionResult> ExtractTemplate([FromBody] LabelImageRequest request)
    {
        if (request.ImageBase64 == null || request.ImageBase64.Length == 0)
            return BadRequest("Image cannot be empty.");

        var bytes = Convert.FromBase64String(Encoding.UTF8.GetString(request.ImageBase64));
        var schema = await _labelAiService.ExtractTemplateAsync(bytes);
        return Ok(schema);
    }

    [HttpPost("generate-from-prompt")]
    public async Task<IActionResult> GenerateFromPrompt([FromBody] LabelPromptRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt))
            return BadRequest("Prompt cannot be empty.");

        var schema = await _labelAiService.GenerateFromPromptAsync(request);
        return Ok(schema);
    }
}

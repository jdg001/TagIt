using TagIt.Api.Models;

namespace TagIt.Api.Interfaces;

public interface ITemplateThumbnailService
{
    /// <summary>
    /// Generate a thumbnail image for a template
    /// </summary>
    /// <param name="template">The template to generate thumbnail for</param>
    /// <param name="width">Thumbnail width in pixels (default: 200)</param>
    /// <param name="height">Thumbnail height in pixels (default: 200)</param>
    /// <returns>PNG image as byte array</returns>
    byte[] GenerateThumbnail(LabelTemplate template, int width = 200, int height = 200);
    
    /// <summary>
    /// Generate a thumbnail image for a template by ID
    /// </summary>
    /// <param name="templateId">The template ID</param>
    /// <param name="width">Thumbnail width in pixels (default: 200)</param>
    /// <param name="height">Thumbnail height in pixels (default: 200)</param>
    /// <returns>PNG image as byte array</returns>
    Task<byte[]> GenerateThumbnailAsync(int templateId, int width = 200, int height = 200);
}

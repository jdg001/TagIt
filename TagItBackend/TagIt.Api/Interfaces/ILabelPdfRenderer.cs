namespace TagIt.Api.Interfaces;

public interface ILabelPdfRenderer
{
    byte[] RenderPdf(string jsonSchema, IDictionary<string, object> data);
}

namespace TagIt.Api.Models;

public record AcceptTemplateRequest(
    int StateChangedBy,
    string? Comments = null
);


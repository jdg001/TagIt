namespace TagIt.Api.Models;

public record AssignTemplateRequest(
    int ReviewerId,
    int AssignedBy
);


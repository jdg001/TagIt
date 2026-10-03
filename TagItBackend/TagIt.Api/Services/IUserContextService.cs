namespace TagIt.Api.Services;

public interface IUserContextService
{
    int GetCurrentUserId();
    string GetCurrentUserEmail();
    string GetCurrentUserRole();
    Guid GetCurrentTenantId();
    bool IsAuthenticated();
}

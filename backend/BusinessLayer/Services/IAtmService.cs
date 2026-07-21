using AtmDashboard.DomainModel.DTOs;

namespace AtmDashboard.BusinessLayer.Services;

public interface IAtmService
{
    Task<IEnumerable<AtmBalanceDto>> GetLatestBalancesAsync();
    Task<IEnumerable<AtmStatusDto>> GetLatestStatusesAsync();

    /// <summary>
    /// Compares the latest report file against the previous one for both
    /// hardware statuses (errors fixed / new / ongoing) and balances
    /// (refilled / recovered / went critical). Thresholds are % remaining.
    /// </summary>
    Task<ComparisonResultDto> GetComparisonAsync(double criticalThreshold, double lowThreshold);
}

using AtmDashboard.DomainModel.Entities;

namespace AtmDashboard.DataLayer.Repositories;

public interface IAtmRepository
{
    Task<IEnumerable<AtmBalanceFile>> GetLatestBalancesAsync();
    Task<IEnumerable<AtmStatusFile>> GetLatestStatusesAsync();

    /// <summary>
    /// Returns the rows of the most recent <paramref name="fileCount"/> balance files,
    /// newest file first. Each inner list contains all ATM rows of one file.
    /// </summary>
    Task<IReadOnlyList<IReadOnlyList<AtmBalanceFile>>> GetBalanceSnapshotsAsync(int fileCount);

    /// <summary>
    /// Returns the rows of the most recent <paramref name="fileCount"/> status files,
    /// newest file first. Each inner list contains all ATM rows of one file.
    /// </summary>
    Task<IReadOnlyList<IReadOnlyList<AtmStatusFile>>> GetStatusSnapshotsAsync(int fileCount);
}

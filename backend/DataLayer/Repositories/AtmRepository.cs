using AtmDashboard.DataLayer.Context;
using AtmDashboard.DomainModel.Entities;
using Microsoft.EntityFrameworkCore;

namespace AtmDashboard.DataLayer.Repositories;

public class AtmRepository : IAtmRepository
{
    private readonly AtmDbContext _context;

    public AtmRepository(AtmDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<AtmBalanceFile>> GetLatestBalancesAsync()
    {
        var snapshots = await GetBalanceSnapshotsAsync(1);
        return snapshots.Count > 0 ? snapshots[0] : Enumerable.Empty<AtmBalanceFile>();
    }

    public async Task<IEnumerable<AtmStatusFile>> GetLatestStatusesAsync()
    {
        var snapshots = await GetStatusSnapshotsAsync(1);
        return snapshots.Count > 0 ? snapshots[0] : Enumerable.Empty<AtmStatusFile>();
    }

    public async Task<IReadOnlyList<IReadOnlyList<AtmBalanceFile>>> GetBalanceSnapshotsAsync(int fileCount)
    {
        // Latest N distinct files, newest first
        var files = await _context.AtmBalanceFiles
            .AsNoTracking()
            .GroupBy(b => b.FileName)
            .Select(g => new { FileName = g.Key, FileDate = g.Max(x => x.BalanceDate) })
            .OrderByDescending(x => x.FileDate)
            .ThenByDescending(x => x.FileName) // deterministic when two files share a date
            .Take(fileCount)
            .ToListAsync();

        if (files.Count == 0)
            return Array.Empty<IReadOnlyList<AtmBalanceFile>>();

        var fileNames = files.Select(f => f.FileName).ToList();
        var rows = await _context.AtmBalanceFiles
            .AsNoTracking()
            .Where(b => fileNames.Contains(b.FileName))
            .ToListAsync();

        return files
            .Select(f => (IReadOnlyList<AtmBalanceFile>)rows.Where(r => r.FileName == f.FileName).ToList())
            .ToList();
    }

    public async Task<IReadOnlyList<IReadOnlyList<AtmStatusFile>>> GetStatusSnapshotsAsync(int fileCount)
    {
        var files = await _context.AtmStatusFiles
            .AsNoTracking()
            .GroupBy(s => s.FileName)
            .Select(g => new { FileName = g.Key, FileDate = g.Max(x => x.FileDate) })
            .OrderByDescending(x => x.FileDate)
            .ThenByDescending(x => x.FileName) // deterministic when two files share a date
            .Take(fileCount)
            .ToListAsync();

        if (files.Count == 0)
            return Array.Empty<IReadOnlyList<AtmStatusFile>>();

        var fileNames = files.Select(f => f.FileName).ToList();
        var rows = await _context.AtmStatusFiles
            .AsNoTracking()
            .Where(s => fileNames.Contains(s.FileName))
            .ToListAsync();

        return files
            .Select(f => (IReadOnlyList<AtmStatusFile>)rows.Where(r => r.FileName == f.FileName).ToList())
            .ToList();
    }
}

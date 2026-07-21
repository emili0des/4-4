using AtmDashboard.BusinessLayer.Decoding;
using AtmDashboard.DataLayer.Repositories;
using AtmDashboard.DomainModel.DTOs;
using AtmDashboard.DomainModel.Entities;

namespace AtmDashboard.BusinessLayer.Services;

public class AtmService : IAtmService
{
    private readonly IAtmRepository _repository;

    // Field keys match the frontend's column keys so the UI can reuse its filters/labels
    private static readonly (string Key, string Label, Func<AtmStatusFile, string?> Get)[] StatusComponents =
    {
        ("status",     "ATM Status",  s => s.Status),
        ("net",        "Network",     s => s.NET),
        ("crd_reader", "Card Reader", s => s.CrdReader),
        ("dispenser",  "Dispenser",   s => s.Dispenser),
        ("print_user", "Printer",     s => s.PrintUser),
        ("door",       "Safe Door",   s => s.Door),
        ("encryptor",  "Encryptor",   s => s.Encryptor),
        ("card_bin",   "Card Bin",    s => s.CardBin),
        ("rej_bin",    "Reject Bin",  s => s.RejBin),
        ("depository", "Depository",  s => s.Depository),
        ("bil_cas1",   "Cassette 1",  s => s.BilCas1),
        ("bil_cas2",   "Cassette 2",  s => s.BilCas2),
        ("bil_cas3",   "Cassette 3",  s => s.BilCas3),
        ("bil_cas4",   "Cassette 4",  s => s.BilCas4),
        ("bil_cas5",   "Cassette 5",  s => s.BilCas5),
        ("bil_cas6",   "Cassette 6",  s => s.BilCas6),
        ("bil_cas7",   "Cassette 7",  s => s.BilCas7),
    };

    public AtmService(IAtmRepository repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<AtmBalanceDto>> GetLatestBalancesAsync()
    {
        var entities = await _repository.GetLatestBalancesAsync();
        return entities.Select(MapToDto);
    }

    public async Task<IEnumerable<AtmStatusDto>> GetLatestStatusesAsync()
    {
        var entities = await _repository.GetLatestStatusesAsync();
        return entities.Select(MapToDto);
    }

    public async Task<ComparisonResultDto> GetComparisonAsync(double criticalThreshold, double lowThreshold)
    {
        var statusSnapshots = await _repository.GetStatusSnapshotsAsync(2);
        var balanceSnapshots = await _repository.GetBalanceSnapshotsAsync(2);

        var result = new ComparisonResultDto
        {
            HasPreviousStatusFile = statusSnapshots.Count >= 2,
            HasPreviousBalanceFile = balanceSnapshots.Count >= 2,
        };

        if (result.HasPreviousStatusFile)
            result.StatusComparison = BuildStatusComparison(statusSnapshots[0], statusSnapshots[1]);

        if (result.HasPreviousBalanceFile)
            result.BalanceComparison = BuildBalanceComparison(
                balanceSnapshots[0], balanceSnapshots[1], criticalThreshold, lowThreshold);

        return result;
    }

    // ── Hardware status comparison ──────────────────────────────────────────

    private static StatusComparisonDto BuildStatusComparison(
        IReadOnlyList<AtmStatusFile> current, IReadOnlyList<AtmStatusFile> previous)
    {
        var comparison = new StatusComparisonDto
        {
            CurrentFile = new ComparisonFileDto
            {
                FileName = current.FirstOrDefault()?.FileName,
                FileDate = current.FirstOrDefault()?.FileDate,
            },
            PreviousFile = new ComparisonFileDto
            {
                FileName = previous.FirstOrDefault()?.FileName,
                FileDate = previous.FirstOrDefault()?.FileDate,
            },
        };

        var prevByPid = previous
            .Where(s => !string.IsNullOrWhiteSpace(s.AtmPID))
            .GroupBy(s => s.AtmPID!.Trim())
            .ToDictionary(g => g.Key, g => g.First());

        var currentPids = new HashSet<string>();

        foreach (var curr in current)
        {
            var pid = curr.AtmPID?.Trim();
            if (string.IsNullOrEmpty(pid)) continue;
            if (!currentPids.Add(pid)) continue; // skip duplicate rows for the same ATM

            if (!prevByPid.TryGetValue(pid, out var prev))
            {
                comparison.AtmsAdded.Add(pid);
                continue;
            }

            var change = new AtmStatusChangeDto
            {
                AtmPID = pid,
                AtmName = curr.AtmName,
                Branch = curr.Branch,
            };

            foreach (var (key, label, get) in StatusComponents)
            {
                var prevRaw = get(prev);
                var currRaw = get(curr);
                var prevStatus = HardwareStatusDecoder.Decode(prevRaw, key);
                var currStatus = HardwareStatusDecoder.Decode(currRaw, key);
                var prevErr = HardwareStatusDecoder.IsError(prevStatus);
                var currErr = HardwareStatusDecoder.IsError(currStatus);

                if (!prevErr && !currErr) continue;

                var componentChange = new ComponentChangeDto
                {
                    Component = key,
                    Label = label,
                    PreviousRaw = prevRaw?.Trim(),
                    CurrentRaw = currRaw?.Trim(),
                    PreviousStatus = prevStatus,
                    CurrentStatus = currStatus,
                };

                if (prevErr && !currErr) change.Fixed.Add(componentChange);
                else if (!prevErr && currErr) change.NewErrors.Add(componentChange);
                else change.Ongoing.Add(componentChange);
            }

            if (change.Fixed.Count == 0 && change.NewErrors.Count == 0 && change.Ongoing.Count == 0)
                continue;

            change.FullyRecovered = change.Fixed.Count > 0
                && change.NewErrors.Count == 0
                && change.Ongoing.Count == 0;

            comparison.Atms.Add(change);
        }

        comparison.AtmsRemoved = prevByPid.Keys
            .Where(pid => !currentPids.Contains(pid))
            .OrderBy(pid => pid)
            .ToList();

        // New errors first, then ongoing, then fixed-only ATMs
        comparison.Atms = comparison.Atms
            .OrderByDescending(a => a.NewErrors.Count)
            .ThenByDescending(a => a.Ongoing.Count)
            .ThenBy(a => a.AtmPID)
            .ToList();

        comparison.Summary = new StatusComparisonSummaryDto
        {
            FixedCount = comparison.Atms.Sum(a => a.Fixed.Count),
            NewCount = comparison.Atms.Sum(a => a.NewErrors.Count),
            OngoingCount = comparison.Atms.Sum(a => a.Ongoing.Count),
            AtmsFullyRecovered = comparison.Atms.Count(a => a.FullyRecovered),
            AtmsDegraded = comparison.Atms.Count(a =>
                a.NewErrors.Count > 0 && a.Fixed.Count == 0 && a.Ongoing.Count == 0),
        };

        return comparison;
    }

    // ── Balance comparison ──────────────────────────────────────────────────

    private static BalanceComparisonDto BuildBalanceComparison(
        IReadOnlyList<AtmBalanceFile> current, IReadOnlyList<AtmBalanceFile> previous,
        double criticalThreshold, double lowThreshold)
    {
        var comparison = new BalanceComparisonDto
        {
            CurrentFile = new ComparisonFileDto
            {
                FileName = current.FirstOrDefault()?.FileName,
                FileDate = current.FirstOrDefault()?.BalanceDate,
            },
            PreviousFile = new ComparisonFileDto
            {
                FileName = previous.FirstOrDefault()?.FileName,
                FileDate = previous.FirstOrDefault()?.BalanceDate,
            },
        };

        static string? KeyOf(AtmBalanceFile b) =>
            (b.TerminalId ?? b.AtmId ?? b.AtmName)?.Trim();

        static double PctOf(AtmBalanceFile b) =>
            b.InitialBalanceAll is > 0
                ? (double)((b.RemainingBalanceAll ?? 0) / b.InitialBalanceAll.Value) * 100
                : 0;

        string LevelOf(double pct) =>
            pct <= criticalThreshold ? "critical" : pct <= lowThreshold ? "low" : "healthy";

        var prevByKey = previous
            .Select(b => (Key: KeyOf(b), Row: b))
            .Where(x => !string.IsNullOrEmpty(x.Key))
            .GroupBy(x => x.Key!)
            .ToDictionary(g => g.Key, g => g.First().Row);

        var summary = new BalanceComparisonSummaryDto();
        var seenKeys = new HashSet<string>();

        foreach (var curr in current)
        {
            var key = KeyOf(curr);
            if (string.IsNullOrEmpty(key) || !prevByKey.TryGetValue(key, out var prev))
                continue;
            if (!seenKeys.Add(key)) continue; // skip duplicate rows for the same ATM

            var prevPct = PctOf(prev);
            var currPct = PctOf(curr);
            var prevLevel = LevelOf(prevPct);
            var currLevel = LevelOf(currPct);

            var delta = (curr.RemainingBalanceAll.HasValue && prev.RemainingBalanceAll.HasValue)
                ? curr.RemainingBalanceAll.Value - prev.RemainingBalanceAll.Value
                : (decimal?)null;

            var changeType = delta is > 0 ? "refilled" : delta is < 0 ? "dropped" : "unchanged";
            var isFixed = prevLevel != "healthy" && currLevel == "healthy";

            if (changeType == "refilled") summary.RefilledCount++;
            if (isFixed) summary.RecoveredCount++;
            if (prevLevel != "critical" && currLevel == "critical") summary.WentCriticalCount++;
            if (prevLevel == "critical" && currLevel == "critical") summary.StillCriticalCount++;

            // Only report rows that changed or still need attention
            if (changeType == "unchanged" && currLevel == "healthy" && prevLevel == "healthy")
                continue;

            comparison.Atms.Add(new AtmBalanceChangeDto
            {
                TerminalId = curr.TerminalId?.Trim(),
                AtmId = curr.AtmId?.Trim(),
                AtmName = curr.AtmName,
                Branch = curr.Branch,
                PreviousRemaining = prev.RemainingBalanceAll,
                CurrentRemaining = curr.RemainingBalanceAll,
                Delta = delta,
                PreviousPct = Math.Round(prevPct, 1),
                CurrentPct = Math.Round(currPct, 1),
                PreviousLevel = prevLevel,
                CurrentLevel = currLevel,
                ChangeType = changeType,
                IsFixed = isFixed,
            });
        }

        comparison.Atms = comparison.Atms
            .OrderBy(a => a.CurrentPct)
            .ThenBy(a => a.AtmName)
            .ToList();

        comparison.Summary = summary;
        return comparison;
    }

    // ── Entity → DTO mapping ────────────────────────────────────────────────

    private static AtmBalanceDto MapToDto(AtmBalanceFile e) => new()
    {
        RecordId = e.RecordId,
        FileName = e.FileName,
        BalanceDate = e.BalanceDate,
        AtmName = e.AtmName,
        AtmId = e.AtmId,
        TerminalId = e.TerminalId,
        Branch = e.Branch,
        InitialBalanceAll = e.InitialBalanceAll,
        RemainingBalanceAll = e.RemainingBalanceAll,
        NoTransactionsAll = e.NoTransactionsAll,
        NoWithdrawalsAll = e.NoWithdrawalsAll,
        EurInitial = e.EurInitial,
        EurRemaining = e.EurRemaining,
        Timestamp = e.Timestamp
    };

    private static AtmStatusDto MapToDto(AtmStatusFile e) => new()
    {
        RecordId = e.RecordId,
        FileName = e.FileName,
        FileDate = e.FileDate,
        AtmPID = e.AtmPID,
        AtmName = e.AtmName,
        Status = e.Status,
        NET = e.NET,
        CrdReader = e.CrdReader,
        Dispenser = e.Dispenser,
        Encryptor = e.Encryptor,
        Depository = e.Depository,
        BilCas1 = e.BilCas1,
        BilCas2 = e.BilCas2,
        BilCas3 = e.BilCas3,
        BilCas4 = e.BilCas4,
        BilCas5 = e.BilCas5,
        BilCas6 = e.BilCas6,
        BilCas7 = e.BilCas7,
        PrintUser = e.PrintUser,
        Door = e.Door,
        CardBin = e.CardBin,
        RejBin = e.RejBin,
        Owner = e.Owner,
        SupVs = e.SupVs,
        Branch = e.Branch
    };
}

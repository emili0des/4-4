namespace AtmDashboard.DomainModel.DTOs;

/// <summary>
/// Result of comparing the latest report file against the previous one,
/// for both hardware statuses and cash balances.
/// </summary>
public class ComparisonResultDto
{
    public bool HasPreviousStatusFile { get; set; }
    public bool HasPreviousBalanceFile { get; set; }
    public StatusComparisonDto? StatusComparison { get; set; }
    public BalanceComparisonDto? BalanceComparison { get; set; }
}

public class ComparisonFileDto
{
    public string? FileName { get; set; }
    public DateTime? FileDate { get; set; }
}

// ── Hardware status comparison ──────────────────────────────────────────────

public class StatusComparisonDto
{
    public ComparisonFileDto CurrentFile { get; set; } = new();
    public ComparisonFileDto PreviousFile { get; set; } = new();
    public StatusComparisonSummaryDto Summary { get; set; } = new();

    /// <summary>ATMs that have at least one fixed, new, or ongoing error.</summary>
    public List<AtmStatusChangeDto> Atms { get; set; } = new();

    /// <summary>ATM PIDs present in the current file but not the previous one.</summary>
    public List<string> AtmsAdded { get; set; } = new();

    /// <summary>ATM PIDs present in the previous file but missing from the current one.</summary>
    public List<string> AtmsRemoved { get; set; } = new();
}

public class StatusComparisonSummaryDto
{
    /// <summary>Device errors present in the previous file that are gone now.</summary>
    public int FixedCount { get; set; }

    /// <summary>Device errors that appeared in the current file.</summary>
    public int NewCount { get; set; }

    /// <summary>Device errors present in both files.</summary>
    public int OngoingCount { get; set; }

    /// <summary>ATMs that had errors before and are fully clean now.</summary>
    public int AtmsFullyRecovered { get; set; }

    /// <summary>ATMs that were clean before and have errors now.</summary>
    public int AtmsDegraded { get; set; }
}

public class AtmStatusChangeDto
{
    public string? AtmPID { get; set; }
    public string? AtmName { get; set; }
    public string? Branch { get; set; }

    /// <summary>True when every error from the previous file is fixed and no new ones appeared.</summary>
    public bool FullyRecovered { get; set; }

    public List<ComponentChangeDto> Fixed { get; set; } = new();
    public List<ComponentChangeDto> NewErrors { get; set; } = new();
    public List<ComponentChangeDto> Ongoing { get; set; } = new();
}

public class ComponentChangeDto
{
    /// <summary>Field key matching the frontend (e.g. "dispenser", "crd_reader").</summary>
    public string Component { get; set; } = "";

    /// <summary>Human-readable name (e.g. "Dispenser", "Card Reader").</summary>
    public string Label { get; set; } = "";

    public string? PreviousRaw { get; set; }
    public string? CurrentRaw { get; set; }

    /// <summary>Decoded severity in the previous file: OK / Warning / Suspended / Critical / Disabled / Unknown.</summary>
    public string PreviousStatus { get; set; } = "";

    /// <summary>Decoded severity in the current file.</summary>
    public string CurrentStatus { get; set; } = "";
}

// ── Balance comparison ──────────────────────────────────────────────────────

public class BalanceComparisonDto
{
    public ComparisonFileDto CurrentFile { get; set; } = new();
    public ComparisonFileDto PreviousFile { get; set; } = new();
    public BalanceComparisonSummaryDto Summary { get; set; } = new();

    /// <summary>ATMs whose balance changed or that are not healthy right now.</summary>
    public List<AtmBalanceChangeDto> Atms { get; set; } = new();
}

public class BalanceComparisonSummaryDto
{
    /// <summary>ATMs whose remaining cash increased since the previous file.</summary>
    public int RefilledCount { get; set; }

    /// <summary>ATMs that were critical or low before and are healthy now.</summary>
    public int RecoveredCount { get; set; }

    /// <summary>ATMs that were not critical before but are critical now.</summary>
    public int WentCriticalCount { get; set; }

    /// <summary>ATMs critical in both files (refill still pending).</summary>
    public int StillCriticalCount { get; set; }
}

public class AtmBalanceChangeDto
{
    public string? TerminalId { get; set; }
    public string? AtmId { get; set; }
    public string? AtmName { get; set; }
    public string? Branch { get; set; }

    public decimal? PreviousRemaining { get; set; }
    public decimal? CurrentRemaining { get; set; }

    /// <summary>CurrentRemaining − PreviousRemaining (positive = cash added).</summary>
    public decimal? Delta { get; set; }

    public double PreviousPct { get; set; }
    public double CurrentPct { get; set; }

    /// <summary>"critical" | "low" | "healthy" in the previous file.</summary>
    public string PreviousLevel { get; set; } = "";

    /// <summary>"critical" | "low" | "healthy" in the current file.</summary>
    public string CurrentLevel { get; set; } = "";

    /// <summary>"refilled" | "dropped" | "unchanged".</summary>
    public string ChangeType { get; set; } = "";

    /// <summary>True when the ATM was low/critical before and is healthy now.</summary>
    public bool IsFixed { get; set; }
}

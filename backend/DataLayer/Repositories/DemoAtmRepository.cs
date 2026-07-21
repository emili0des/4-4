using AtmDashboard.DomainModel.Entities;

namespace AtmDashboard.DataLayer.Repositories;

/// <summary>
/// In-memory repository used when "UseDemoData": true in appsettings.
/// Serves two generated report files (previous + current, 30 minutes apart)
/// so the dashboard and the file-comparison feature work without SQL Server.
/// Scenarios covered: errors fixed, new errors, ongoing errors, refilled ATMs,
/// balance drops, still-critical ATMs, and ATMs added/removed between files.
/// </summary>
public class DemoAtmRepository : IAtmRepository
{
    private const string PrevStatusFile = "ASTNN123_260718_D001.txt";
    private const string CurrStatusFile = "ASTNN123_260718_D002.txt";
    private const string PrevBalanceFile = "ABALN123_260718_D001.txt";
    private const string CurrBalanceFile = "ABALN123_260718_D002.txt";

    /// <summary>
    /// Report timestamps anchored to the last half-hour boundary so repeated
    /// requests return stable file dates (like a real 30-minute report cadence)
    /// and the balance/status endpoints agree on the same instant.
    /// </summary>
    private static DateTime CurrentReportDate()
    {
        var now = DateTime.Now;
        return now.AddTicks(-(now.Ticks % TimeSpan.FromMinutes(30).Ticks));
    }

    public Task<IEnumerable<AtmBalanceFile>> GetLatestBalancesAsync()
    {
        var (current, _) = BuildBalanceFiles();
        return Task.FromResult<IEnumerable<AtmBalanceFile>>(current);
    }

    public Task<IEnumerable<AtmStatusFile>> GetLatestStatusesAsync()
    {
        var (current, _) = BuildStatusFiles();
        return Task.FromResult<IEnumerable<AtmStatusFile>>(current);
    }

    public Task<IReadOnlyList<IReadOnlyList<AtmBalanceFile>>> GetBalanceSnapshotsAsync(int fileCount)
    {
        var (current, previous) = BuildBalanceFiles();
        var snapshots = new List<IReadOnlyList<AtmBalanceFile>> { current, previous };
        return Task.FromResult<IReadOnlyList<IReadOnlyList<AtmBalanceFile>>>(
            snapshots.Take(fileCount).ToList());
    }

    public Task<IReadOnlyList<IReadOnlyList<AtmStatusFile>>> GetStatusSnapshotsAsync(int fileCount)
    {
        var (current, previous) = BuildStatusFiles();
        var snapshots = new List<IReadOnlyList<AtmStatusFile>> { current, previous };
        return Task.FromResult<IReadOnlyList<IReadOnlyList<AtmStatusFile>>>(
            snapshots.Take(fileCount).ToList());
    }

    // ── Status snapshots ────────────────────────────────────────────────────

    private static (List<AtmStatusFile> Current, List<AtmStatusFile> Previous) BuildStatusFiles()
    {
        var currDate = CurrentReportDate();
        var prevDate = currDate.AddMinutes(-30);
        var id = 1;

        AtmStatusFile Status(
            string file, DateTime date, string pid, string name, string branch,
            string status = "INS", string net = "ONL",
            string crdReader = "", string dispenser = "", string encryptor = "",
            string depository = "", string printUser = "", string door = "",
            string cardBin = "", string rejBin = "",
            string bilCas5 = "", string bilCas6 = "", string bilCas7 = "") => new()
        {
            RecordId = id++,
            FileName = file,
            FileDate = date,
            AtmPID = pid,
            AtmName = name,
            Status = status,
            NET = net,
            CrdReader = crdReader,
            Dispenser = dispenser,
            Encryptor = encryptor,
            Depository = depository,
            PrintUser = printUser,
            Door = door,
            CardBin = cardBin,
            RejBin = rejBin,
            BilCas1 = "--------",
            BilCas2 = "--------",
            BilCas3 = "--------",
            BilCas4 = "--------",
            BilCas5 = bilCas5,
            BilCas6 = bilCas6,
            BilCas7 = bilCas7,
            Owner = "RBAL",
            SupVs = "OFF",
            Branch = branch,
        };

        var previous = new List<AtmStatusFile>
        {
            // Dispenser critical → will be FIXED in current
            Status(PrevStatusFile, prevDate, "RB001001", "Tirana Center", "001", dispenser: "DI170600"),
            // Clean → will get a NEW card reader error
            Status(PrevStatusFile, prevDate, "RB001002", "Tirana Airport", "001"),
            // Encryptor warning → ONGOING
            Status(PrevStatusFile, prevDate, "RB002001", "Durres Port", "002", encryptor: "EC130000"),
            // Offline → will be FIXED (back online)
            Status(PrevStatusFile, prevDate, "RB003001", "Vlora Beach", "003", net: "OFF"),
            // Out of service + offline → ONGOING (both)
            Status(PrevStatusFile, prevDate, "RB004001", "Shkodra Main", "004", status: "OUT", net: "OFF"),
            // Printer warning (low paper) → will be FIXED
            Status(PrevStatusFile, prevDate, "RB005001", "Elbasan Square", "005", printUser: "PU130500"),
            // Clean both files
            Status(PrevStatusFile, prevDate, "RB006001", "Korca Center", "006"),
            // Cassette 5 critical → FIXED, but a NEW depository warning appears
            Status(PrevStatusFile, prevDate, "RB007001", "Fier Plaza", "007", bilCas5: "C5170600"),
            // Clean both files
            Status(PrevStatusFile, prevDate, "RB008001", "Berat Castle", "008"),
            // Card bin warning → ONGOING and worsened to critical
            Status(PrevStatusFile, prevDate, "RB009001", "Saranda Port", "009", cardBin: "CB130003"),
            // Present only in the previous file (removed from current)
            Status(PrevStatusFile, prevDate, "RB011001", "Gjirokastra Old Town", "011"),
        };

        var current = new List<AtmStatusFile>
        {
            Status(CurrStatusFile, currDate, "RB001001", "Tirana Center", "001"),                          // fixed
            Status(CurrStatusFile, currDate, "RB001002", "Tirana Airport", "001", crdReader: "CR170000"),  // new error
            Status(CurrStatusFile, currDate, "RB002001", "Durres Port", "002", encryptor: "EC130000"),     // ongoing
            Status(CurrStatusFile, currDate, "RB003001", "Vlora Beach", "003"),                            // fixed
            Status(CurrStatusFile, currDate, "RB004001", "Shkodra Main", "004", status: "OUT", net: "OFF"),// ongoing
            Status(CurrStatusFile, currDate, "RB005001", "Elbasan Square", "005"),                         // fixed
            Status(CurrStatusFile, currDate, "RB006001", "Korca Center", "006"),                           // clean
            Status(CurrStatusFile, currDate, "RB007001", "Fier Plaza", "007", depository: "NA130100"),     // fixed + new
            Status(CurrStatusFile, currDate, "RB008001", "Berat Castle", "008"),                           // clean
            Status(CurrStatusFile, currDate, "RB009001", "Saranda Port", "009", cardBin: "CB170003"),      // worsened
            Status(CurrStatusFile, currDate, "RB010001", "Lezha Center", "010"),                           // added
        };

        return (current, previous);
    }

    // ── Balance snapshots ───────────────────────────────────────────────────

    private static (List<AtmBalanceFile> Current, List<AtmBalanceFile> Previous) BuildBalanceFiles()
    {
        var currDate = CurrentReportDate();
        var prevDate = currDate.AddMinutes(-30);
        var id = 1;

        AtmBalanceFile Balance(
            string file, DateTime date, string terminalId, string atmId, string name, string branch,
            decimal initial, decimal remaining, int transactions, int withdrawals,
            decimal? eurInitial = null, decimal? eurRemaining = null) => new()
        {
            RecordId = id++,
            FileName = file,
            BalanceDate = date,
            AtmName = name,
            AtmId = atmId,
            TerminalId = terminalId,
            Branch = branch,
            InitialBalanceAll = initial,
            RemainingBalanceAll = remaining,
            NoTransactionsAll = transactions,
            NoWithdrawalsAll = withdrawals,
            EurInitial = eurInitial,
            EurRemaining = eurRemaining,
            Timestamp = date,
        };

        var previous = new List<AtmBalanceFile>
        {
            // Critical 12% → refilled to 95%
            Balance(PrevBalanceFile, prevDate, "RB001001", "0101", "Tirana Center", "001", 10_000_000m, 1_200_000m, 412, 388, 50_000m, 8_000m),
            // Healthy 80% → drops to 72%
            Balance(PrevBalanceFile, prevDate, "RB001002", "0102", "Tirana Airport", "001", 10_000_000m, 8_000_000m, 120, 98),
            // Low 35% → keeps dropping to 30%
            Balance(PrevBalanceFile, prevDate, "RB002001", "0201", "Durres Port", "002", 8_000_000m, 2_800_000m, 260, 231),
            // Healthy 65% → 60%
            Balance(PrevBalanceFile, prevDate, "RB003001", "0301", "Vlora Beach", "003", 8_000_000m, 5_200_000m, 187, 154),
            // Critical 15% → still critical 13%
            Balance(PrevBalanceFile, prevDate, "RB004001", "0401", "Shkodra Main", "004", 6_000_000m, 900_000m, 340, 322),
            // Healthy 90% → 88%
            Balance(PrevBalanceFile, prevDate, "RB005001", "0501", "Elbasan Square", "005", 6_000_000m, 5_400_000m, 96, 71),
            // Healthy 55% → drops to 42% (goes low)
            Balance(PrevBalanceFile, prevDate, "RB006001", "0601", "Korca Center", "006", 8_000_000m, 4_400_000m, 210, 189),
            // Low 28% → refilled to 85% (recovered)
            Balance(PrevBalanceFile, prevDate, "RB007001", "0701", "Fier Plaza", "007", 8_000_000m, 2_240_000m, 305, 277),
            // Healthy 75% → unchanged
            Balance(PrevBalanceFile, prevDate, "RB008001", "0801", "Berat Castle", "008", 6_000_000m, 4_500_000m, 88, 65),
            // Healthy 60% → crashes to 18% (goes critical)
            Balance(PrevBalanceFile, prevDate, "RB009001", "0901", "Saranda Port", "009", 10_000_000m, 6_000_000m, 275, 248),
            // Present only in previous file
            Balance(PrevBalanceFile, prevDate, "RB011001", "1101", "Gjirokastra Old Town", "011", 6_000_000m, 3_000_000m, 140, 122),
        };

        var current = new List<AtmBalanceFile>
        {
            Balance(CurrBalanceFile, currDate, "RB001001", "0101", "Tirana Center", "001", 10_000_000m, 9_500_000m, 428, 401, 50_000m, 47_500m),
            Balance(CurrBalanceFile, currDate, "RB001002", "0102", "Tirana Airport", "001", 10_000_000m, 7_200_000m, 165, 137),
            Balance(CurrBalanceFile, currDate, "RB002001", "0201", "Durres Port", "002", 8_000_000m, 2_400_000m, 291, 259),
            Balance(CurrBalanceFile, currDate, "RB003001", "0301", "Vlora Beach", "003", 8_000_000m, 4_800_000m, 205, 170),
            Balance(CurrBalanceFile, currDate, "RB004001", "0401", "Shkodra Main", "004", 6_000_000m, 780_000m, 352, 334),
            Balance(CurrBalanceFile, currDate, "RB005001", "0501", "Elbasan Square", "005", 6_000_000m, 5_280_000m, 108, 82),
            Balance(CurrBalanceFile, currDate, "RB006001", "0601", "Korca Center", "006", 8_000_000m, 3_360_000m, 244, 220),
            Balance(CurrBalanceFile, currDate, "RB007001", "0701", "Fier Plaza", "007", 8_000_000m, 6_800_000m, 312, 283),
            Balance(CurrBalanceFile, currDate, "RB008001", "0801", "Berat Castle", "008", 6_000_000m, 4_500_000m, 88, 65),
            Balance(CurrBalanceFile, currDate, "RB009001", "0901", "Saranda Port", "009", 10_000_000m, 1_800_000m, 356, 329),
            Balance(CurrBalanceFile, currDate, "RB010001", "1001", "Lezha Center", "010", 6_000_000m, 6_000_000m, 2, 1),
        };

        return (current, previous);
    }
}

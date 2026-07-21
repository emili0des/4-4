using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AtmDashboard.DomainModel.Entities;

[Table("AtmBalanceFile")]
public class AtmBalanceFile
{
    [Key]
    public int RecordId { get; set; }
    public string? FileName { get; set; }
    public DateTime? BalanceDate { get; set; }
    public string? AtmName { get; set; }
    public string? AtmId { get; set; }
    public string? TerminalId { get; set; }
    public string? Branch { get; set; }
    public decimal? InitialBalanceAll { get; set; }
    public decimal? RemainingBalanceAll { get; set; }
    public int? NoTransactionsAll { get; set; }
    public int? NoWithdrawalsAll { get; set; }
    public decimal? EurInitial { get; set; }
    public decimal? EurRemaining { get; set; }
    public DateTime? Timestamp { get; set; }
}

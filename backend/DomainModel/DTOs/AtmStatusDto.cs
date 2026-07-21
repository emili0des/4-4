namespace AtmDashboard.DomainModel.DTOs;

public class AtmStatusDto
{
    public int? RecordId { get; set; }
    public string? FileName { get; set; }
    public DateTime? FileDate { get; set; }
    public string? AtmPID { get; set; }
    public string? AtmName { get; set; }
    public string? Status { get; set; }
    public string? NET { get; set; }
    public string? CrdReader { get; set; }
    public string? Dispenser { get; set; }
    public string? Encryptor { get; set; }
    public string? Depository { get; set; }
    public string? BilCas1 { get; set; }
    public string? BilCas2 { get; set; }
    public string? BilCas3 { get; set; }
    public string? BilCas4 { get; set; }
    public string? BilCas5 { get; set; }
    public string? BilCas6 { get; set; }
    public string? BilCas7 { get; set; }
    public string? PrintUser { get; set; }
    public string? Door { get; set; }
    public string? CardBin { get; set; }
    public string? RejBin { get; set; }
    public string? Owner { get; set; }
    public string? SupVs { get; set; }
    public string? Branch { get; set; }
}

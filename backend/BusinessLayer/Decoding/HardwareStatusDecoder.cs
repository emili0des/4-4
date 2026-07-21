namespace AtmDashboard.BusinessLayer.Decoding;

/// <summary>
/// Server-side port of the frontend hardwareStatusDecoder.ts severity logic,
/// based on the ATM status file specification (Tables 2–5).
/// Only the severity classification is needed for file-to-file comparison.
/// </summary>
public static class HardwareStatusDecoder
{
    public const string Ok = "OK";
    public const string Warning = "Warning";
    public const string Suspended = "Suspended";
    public const string Critical = "Critical";
    public const string Disabled = "Disabled";
    public const string Unknown = "Unknown";
    public const string NotConfigured = "Not Configured";

    /// <summary>
    /// Decodes any status field to a severity string.
    /// "status" and "net" are 3-char codes; everything else is an 8-char device code.
    /// </summary>
    public static string Decode(string? raw, string fieldKey) => fieldKey switch
    {
        "status" => DecodeAtmGeneralStatus(raw),
        "net" => DecodeNetworkStatus(raw),
        _ => DecodeDeviceCode(raw),
    };

    /// <summary>An error is anything configured that is not OK — mirrors the frontend's hasError().</summary>
    public static bool IsError(string severity) =>
        severity is Warning or Suspended or Critical or Disabled or Unknown;

    // INS = In Service, NOP = No Polling, OUT = Out of Service, REP = Repair, UNK = Unknown
    private static string DecodeAtmGeneralStatus(string? raw) =>
        raw?.Trim().ToUpperInvariant() switch
        {
            "INS" => Ok,
            "NOP" or "UNK" => Warning,
            "OUT" or "REP" => Critical,
            _ => Ok, // null, blank, or unrecognized — not decodable, treated as no error
        };

    private static string DecodeNetworkStatus(string? raw) =>
        raw?.Trim().ToUpperInvariant() switch
        {
            "ONL" => Ok,
            "UNK" => Warning,
            "OFF" => Critical,
            _ => Ok,
        };

    // 8-char code: [1-2] device id, [3] enum, [4] status, [5-6] supply, [7-8] additional
    private static string DecodeDeviceCode(string? raw)
    {
        if (string.IsNullOrEmpty(raw)) return Ok;

        var trimmed = raw.Trim().ToUpperInvariant();
        if (trimmed.Length == 0) return Ok;             // 8 spaces = fully healthy
        if (trimmed.Contains('-')) return NotConfigured; // 8 dashes = not installed
        if (trimmed.Length < 8) return Ok;               // not decodable

        var supply = trimmed.Substring(4, 2);
        if (supply is "08" or "09") return NotConfigured; // not installed / not configured

        return trimmed[3] switch
        {
            '0' => Ok,
            '3' => Warning,
            '5' => Suspended,
            '7' => Critical,
            '9' => Disabled,
            _ => Unknown,
        };
    }
}

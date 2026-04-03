# ATM Status File Format Reference

> **Source:** Official specification document (PDF)
> **Purpose:** Reference for parsing and understanding ATM Status report files ingested into `AtmStatusFile` table.

---

## 1. Report Description

- Generated every **N minutes** (N = 15, 30, 60, 90, 120, etc. — configured per Bank)
- Reflects all ATM device statuses for all Bank ATMs at the moment of report creation
- Records are ordered by **ATM Terminal ID**

---

## 2. Report File Naming Convention

```
ASTN N <bbb> _ <yymmdd> _ D<NNN>.txt
```

| Part | Type | Description |
|------|------|-------------|
| `A` | Constant | ATM Reports group |
| `STN` | Constant | Statuses Report |
| `N` | Constant | No card numbers in report |
| `bbb` | Variable | Bank Code in UPC systems |
| `yymmdd` | Variable | Date of reported period |
| `D` | Constant | Daily Report (`M` = Monthly Report) |
| `NNN` | Variable | Report number within the day |

**Example:** `ASTNN123_260316_D001.txt`

---

## 3. File Structure

```
HDR        ← File header (1 record)
*          ← Comment lines (column headers)
DAT | Bank | Branch 1 | ATM 1 data
DAT | Bank | Branch 1 | ATM 2 data
...
TRL        ← Trailer for Branch 1 (ATM count)
...
DAT | Bank | Branch k | ATM 1 data
...
TRL        ← Trailer for Branch k
```

### Record Type Identifiers

| Prefix | Description |
|--------|-------------|
| `HDR` | File header |
| `TRL` | File trailer (per branch) |
| `DAT` | ATM status data row |
| `*` | Comment / column header |

---

## 4. Record Field Positions

### HDR Record

| Start | End | Length | Description |
|-------|-----|--------|-------------|
| 1 | 3 | 3 | `HDR` |
| 4 | 4 | 1 | Separator `│` (chr 179) |
| 5 | 12 | 8 | Report time `hh:mi:ss` |
| 13 | 13 | 1 | Space |
| 14 | 23 | 10 | Report date `DD-MM-YYYY` |
| 24 | 24 | 1 | Separator `│` |
| 25 | 51 | 26 | File name |
| 52 | 55 | 4 | File version |
| 56 | 56 | 1 | Separator `│` |
| 57 | 77 | 21 | Bank name |
| 78 | 78 | 1 | Separator `│` |
| 79 | 108 | 30 | Bank branch/department |

### DAT Record

| Start | End | Length | Field | DB Column |
|-------|-----|--------|-------|-----------|
| 1 | 3 | 3 | `DAT` | — |
| 4 | 4 | 1 | Separator `│` | — |
| 5 | 9 | 5 | Bank code (Owner) | `Owner` |
| 10 | 10 | 1 | Separator `│` | — |
| 11 | 15 | 5 | Branch/department code | `Branch` |
| 16 | 16 | 1 | Separator `│` | — |
| 17 | 24 | 8 | ATM Terminal ID | `AtmPID` |
| 25 | 25 | 1 | Separator `│` | — |
| 26 | 31 | 6 | ATM status | `Status` |
| 32 | 32 | 1 | Separator `│` | — |
| 33 | 36 | 4 | Network status | `NET` |
| 37 | 37 | 1 | Separator `│` | — |
| 38 | 42 | 5 | Supervisor mode | `SupVs` |
| 43 | 43 | 1 | Separator `│` | — |
| 44 | 51 | 8 | Safe door | `Door` |
| 52 | 52 | 1 | Separator `│` | — |
| 53 | 60 | 8 | Card reader status | `CrdReader` |
| 61 | 61 | 1 | Separator `│` | — |
| 62 | 64 | 3 | Card reader M-Status | `CrdReaderNo` |
| 65 | 65 | 1 | Separator `│` | — |
| 66 | 73 | 8 | Cards taken bin status | `CardBin` |
| 74 | 74 | 1 | Separator `│` | — |
| 75 | 82 | 8 | Journal printer status | `PrintAudit` |
| 83 | 83 | 1 | Separator `│` | — |
| 84 | 86 | 3 | Journal printer M-Status | `PrintAuditNo` |
| 87 | 87 | 1 | Separator `│` | — |
| 88 | 95 | 11 | Receipt printer status | `PrintUser` |
| 96 | 96 | 1 | Separator `│` | — |
| 97 | 99 | 3 | Receipt printer M-Status | `PrintUserNo` |
| 100 | 100 | 1 | Separator `│` | — |
| 101 | 108 | 8 | Dispenser status | `Dispenser` |
| 109 | 109 | 1 | Separator `│` | — |
| 110 | 112 | 3 | Dispenser M-Status | `DispenserNo` |
| 113 | 113 | 1 | Separator `│` | — |
| 114 | 121 | 8 | Reject cassette status | `RejBin` |
| 122 | 122 | 1 | Separator `│` | — |
| 123 | 130 | 8 | Type 1 cassette status | `BilCas1` |
| 131 | 131 | 1 | Separator `│` | — |
| 132 | 139 | 8 | Type 2 cassette status | `BilCas2` |
| 140 | 140 | 1 | Separator `│` | — |
| 141 | 148 | 8 | Type 3 cassette status | `BilCas3` |
| 149 | 149 | 1 | Separator `│` | — |
| 150 | 157 | 8 | Type 4 cassette status | `BilCas4` |
| 158 | 158 | 1 | Separator `│` | — |
| 159 | 166 | 8 | Type 5 cassette status | `BilCas5` |
| 167 | 167 | 1 | Separator `│` | — |
| 168 | 175 | 8 | Type 6 cassette status | `BilCas6` |
| 176 | 176 | 1 | Separator `│` | — |
| 177 | 184 | 8 | Type 7 cassette status | `BilCas7` |
| 185 | 185 | 1 | Separator `│` | — |
| 186 | 193 | 8 | Encryptor status | `Encryptor` |
| 194 | 194 | 1 | Separator `│` | — |
| 195 | 197 | 3 | Encryptor M-Status | `EncryptorNo` |
| 198 | 198 | 1 | Separator `│` | — |
| 199 | 206 | 8 | Bills trapped status | `BillTrap` |
| 207 | 207 | 1 | Separator `│` | — |
| 208 | 215 | 8 | Presenter status | `Present` |
| 216 | 216 | 1 | Separator `│` | — |
| 217 | 224 | 8 | Bunch note acceptor status | `Depository` |
| 225 | 225 | 1 | Separator `│` | — |
| 226 | 228 | 3 | Bunch note acceptor M-Status | `DepositoryNo` |

### TRL Record

| Start | End | Length | Description |
|-------|-----|--------|-------------|
| 1 | 3 | 3 | `TRL` |
| 4 | 4 | 1 | Separator `│` |
| 5 | 9 | 5 | Total ATM count for branch (DAT row count) |

---

## 5. Status Code Values

### ATM General Status (positions 26–31)

| Code | Meaning |
|------|---------|
| `REP` | Repair |
| `NOP` | No Polling (host connection blocked) |
| `INS` | In Service |
| `OUT` | Out of Service |
| `UNK` | Unknown |

### Network Status — NET (positions 33–36)

| Code | Meaning |
|------|---------|
| `OFF` | Offline |
| `ONL` | Online |
| `UNK` | Unknown |

### Supervisor Mode — SupVs (positions 38–42)

| Code | Meaning |
|------|---------|
| `SUP` | ATM in supervisor mode |
| `OFF` | Supervisor mode off |

---

## 6. 8-Character Device Status Code Format

Each device column contains an 8-character alphanumeric code decoded as:

```
Position:  [1-2]   [3]      [4]      [5-6]    [7-8]
           Device  Enum     Status   Supply   Additional
Example:   CR      1        0        01       00
           ^^               ^        ^^       ^^
           Card Reader      OK       Sufficient  Enabled
```

### Table 2 — Device Identifiers (positions 1–2)

| Identifier | Device |
|------------|--------|
| `SF` | Safe Door |
| `CR` | Card Reader/Writer |
| `CB` | Card Bin |
| `EJ` | Electronic Journal |
| `PU` | Receipt Printer (User) |
| `DI` | Cash Handler (Dispenser) |
| `RJ` | Currency Reject Bin |
| `C1` | Cassette 1 |
| `C2` | Cassette 2 |
| `C3` | Cassette 3 |
| `C4` | Cassette 4 |
| `C5` | Cassette 5 |
| `C6` | Cassette 6 |
| `C7` | Cassette 7 |
| `EC` | Encryptor |
| `BT` | Bill Trap |
| `PR` | Presenter |
| `NA` | Bunch Note Acceptor |

### Table 3 — Device Status (position 4)

| Identifier | Status |
|------------|--------|
| `0` | OK |
| `3` | Warning |
| `5` | Suspended |
| `7` | Critical |
| `9` | Disabled |

### Table 4 — Device Supply (positions 5–6)

| Identifier | Supply Status |
|------------|--------------|
| `00` | No Overfill Condition |
| `01` | Sufficient Supply |
| `05` | Low Supply |
| `06` | Supplies Gone |
| `07` | Overfill Condition |
| `08` | Not Installed or Unknown State |
| `09` | Product Not Configured |

### Table 5 — Additional Data (positions 7–8)

| Identifier | Meaning |
|------------|---------|
| `00` | Enabled / Closed |
| `01` | In |
| `03` | Open |
| `04` | Out |
| `05` | Disabled |
| `07` | — |

---

## 7. Special Cases

| Value | Meaning |
|-------|---------|
| `--------` | Device not configured / disconnected (8 dashes) |
| `        ` | (8 spaces / blank) Device fully functional, no warnings |

> **Rule:** If positions 4–8 are all `0` (`00000`), the device is completely normal — the column is stored as blank (spaces).

---

## 8. Decode Examples

| Raw Value | Decoded Meaning |
|-----------|----------------|
| `--------` | Door/device not configured — host cannot get status |
| `        ` | CrdReader / CardBin / Dispenser / RejBin / Encryptor — all normal |
| `EJ000007` | Electronic Journal — Disabled (`EJ` + enum `0` + status `0` + supply `00` + additional `07` = Disabled) |
| `PU000100` | Receipt Printer — OK status, Sufficient Supply, Enabled |
| `C1000100` | Cassette 1 — OK status, Sufficient Supply, Enabled |

---

## 9. Notes for Backend Implementation

- The `AtmStatusFile` table in `CENTAUR_DB1_TEST` stores **one row per ATM per report file**
- The `FileName` column stores the source report file name (matches naming convention above)
- `FileDate` stores the timestamp of the report
- `AtmPID` maps to the ATM's Terminal ID (positions 17–24 in DAT record)
- Hardware status decoding (Tables 2–5) is currently done **client-side** in `hardwareStatusDecoder.ts` — may be moved to backend in the future
- `--------` values mean the device is not installed in that ATM model — treat as `null` / not applicable
- Blank values mean the device is fully healthy — treat as OK

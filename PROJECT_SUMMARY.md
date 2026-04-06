# ATM Dashboard — Project Summary

> Last updated: 2026-04-04

---

## Project Overview

A real-time ATM monitoring dashboard built with React + TypeScript (frontend) and .NET C# Web API (backend), connecting to a SQL Server database (`CENTAUR_DB1_TEST`).

The dashboard shows:
- ATM cash balance levels with refill detection
- ATM hardware status (card reader, dispenser, cassettes, etc.)
- Alerts for critical/low ATMs
- Historical delta tracking (what changed since last check)

---

## Architecture

```
Frontend (React + Vite + Tailwind)
    ↓  HTTP GET
Backend (.NET Web API — Visual Studio, other PC)
    ↓  EF Core
SQL Server (CENTAUR_DB1_TEST)
```

### Two-PC Setup
- **This PC:** Frontend development (VS Code / Claude Code)
- **Other PC:** .NET backend development (Visual Studio)
- They communicate over `https://localhost:7143` during development

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| UI Components | Lucide React (icons), Recharts (charts) |
| Backend | .NET C# Web API |
| ORM | Entity Framework Core |
| Database | SQL Server — `CENTAUR_DB1_TEST` |
| Hosting (backend) | IIS / localhost:7143 |

---

## Database Tables

### `AtmBalanceFile`
Stores ATM cash balance reports. One row per ATM per report file.

| Column | Type | Description |
|--------|------|-------------|
| `RecordId` | int | Primary key |
| `FileName` | string | Source balance file name |
| `BalanceDate` | datetime | Date of the balance report |
| `AtmName` | string | ATM display name |
| `AtmId` | string | ATM identifier |
| `TerminalId` | string | Terminal ID (links to status table) |
| `Branch` | string | Branch code |
| `InitialBalanceAll` | decimal | Total cash loaded |
| `RemainingBalanceAll` | decimal | Cash remaining |
| `NoTransactionsAll` | int | Total transactions |
| `NoWithdrawalsAll` | int | Total withdrawals |
| `EurInitial` | decimal | EUR initial amount |
| `EurRemaining` | decimal | EUR remaining amount |
| `Timestamp` | datetime | Record insert timestamp |

### `AtmStatusFile`
Stores ATM hardware status reports. One row per ATM per report file.

| Column | Type | Description |
|--------|------|-------------|
| `RecordId` | int | Primary key |
| `FileName` | string | Source status file name |
| `FileDate` | datetime | Report file timestamp |
| `AtmPID` | string | ATM Terminal ID (positions 17–24 in DAT record) |
| `AtmName` | string | ATM display name |
| `Status` | string | ATM general status (INS/OUT/REP/NOP/UNK) |
| `NET` | string | Network status (ONL/OFF/UNK) |
| `CrdReader` | string | Card reader 8-char status code |
| `Dispenser` | string | Cash dispenser 8-char status code |
| `Encryptor` | string | Encryptor 8-char status code |
| `Depository` | string | Bunch note acceptor 8-char status code |
| `BilCas1`–`BilCas7` | string | Cassette 1–7 status codes |
| `PrintUser` | string | Receipt printer status code |
| `Door` | string | Safe door status code |
| `CardBin` | string | Card bin status code |
| `RejBin` | string | Reject bin status code |
| `Owner` | string | Bank/owner code |
| `SupVs` | string | Supervisor mode |
| `Branch` | string | Branch code |

---

## API Endpoints

Base URL: `https://localhost:7143` (dev) — set via `VITE_API_URL` env variable

| Method | Endpoint | Returns | Description |
|--------|----------|---------|-------------|
| GET | `/api/atm/balances` | `AtmBalance[]` | Latest balance for each ATM |
| GET | `/api/atm/statuses` | `AtmStatus[]` | Latest hardware status for each ATM |

Both endpoints return the **most recent snapshot** — latest file only, one row per ATM.

---

## Frontend Files

| File | Purpose |
|------|---------|
| `api.ts` | API client — fetch functions + TypeScript interfaces |
| `dataContext.ts` | Snapshot manager — tracks current vs previous data for delta detection |
| `Dashboard.tsx` | Main page — all state, data fetching, charts, layout |
| `AtmStatusTable.tsx` | Hardware status table with column filtering and severity sorting |
| `AtmBalanceCard.tsx` | Individual ATM balance card with refill/drop delta badge |
| `AtmDetailsModal.tsx` | Full-screen ATM detail modal (focus-trapped) |
| `HardwareStatusDetail.tsx` | Hardware breakdown component used inside the modal |
| `hardwareStatusDecoder.ts` | Decodes 8-char device codes into human-readable status |
| `ATM_STATUS_FILE_FORMAT.md` | Full spec for the ATM status file format |
| `CLAUDE_CONTEXT.md` | Claude Code context file explaining the project setup |

---

## Frontend Features Implemented

### Dashboard
- Auto-refresh every N seconds (configurable, persisted to localStorage)
- Stale data badge (flags if data is > 5 minutes old)
- Browser notifications for new critical ATMs (permission requested on first alert)
- URL state sync — `filterStatus`, `hardwareFilter`, `searchTerm` in query params
- Settings persisted to localStorage: thresholds, sort order, refresh interval

### Stat Cards
- Critical / Low / Healthy ATM counts
- Delta pills showing change from previous snapshot (↑↓ colored arrows)

### Balance Grid
- Card per ATM showing remaining cash, dispensed, withdrawals
- Progress bar colored by threshold (green / amber / red)
- Delta badge: `↑ REFILLED` (emerald) or `↓ −X%` (red) vs previous snapshot
- Skeleton loading cards while fetching
- Sort dropdown (custom styled — not native `<select>`)

### Hardware Status Table
- Shows only ATMs with issues by default (toggle to show all)
- Column click = filter by that hardware component
- Escape key clears active column filter
- Left border colored by worst severity (red / amber / green)
- Columns auto-hide when no issues in that column
- Severity sorting (worst first)
- Search by ATM ID or branch

### Charts
- Balance distribution pie chart (Critical / Low / Healthy)
- Hardware error type breakdown bar chart
- Delta badges on chart headers showing improvement/degradation

### ATM Detail Modal
- Opens on row or card click
- Full hardware breakdown
- Focus-trapped (Tab/Shift+Tab cycles within modal, Escape closes)

---

## Hardware Status Decoding

Decoding is done client-side in `hardwareStatusDecoder.ts`.

### ATM General Status (3-char)
| Code | Status |
|------|--------|
| `INS` | OK — In Service |
| `NOP` | Warning — No Polling |
| `OUT` | Critical — Out of Service |
| `REP` | Critical — Repair |
| `UNK` | Warning — Unknown |

### Network Status (3-char)
| Code | Status |
|------|--------|
| `ONL` | OK — Online |
| `OFF` | Critical — Offline |
| `UNK` | Warning — Unknown |

### Device Status (8-char code)
```
[1-2] Device ID  [3] Enum  [4] Status  [5-6] Supply  [7-8] Additional
```
- 8 spaces = fully healthy (OK)
- 8 dashes = not configured / not installed
- Status `0`=OK, `3`=Warning, `5`=Suspended, `7`=Critical, `9`=Disabled

---

## What Was Discarded

- **Supabase** — was explored early on, not used. The `supabase/migrations/` folder on the backend PC can be deleted. The SQL errors in Visual Studio (117 `SQL80001` errors) come entirely from VS trying to lint those PostgreSQL files as T-SQL — deleting the folder removes all errors.
- No Supabase client libraries are used anywhere in the current codebase.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (defaults to `https://localhost:7143`) |

---

## Current Status

- Frontend: complete and functional
- Backend: built in Visual Studio on the other PC, DB connection tested and working
- DB: SQL Server `CENTAUR_DB1_TEST`, tables created via EF Core migrations
- Integration: frontend ↔ backend ↔ DB connected and tested

# ATM Dashboard — Project Summary

> Last updated: 2026-07-21

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

### Repository Layout (this PC now holds the full stack)
```
frontend/          React + Vite + Tailwind app (npm run dev → http://localhost:5173)
  src/components/  Dashboard, ComparisonPanel, AtmBalanceCard, AtmStatusTable, …
  src/lib/         api.ts, dataContext.ts, hardwareStatusDecoder.ts
backend/           .NET 8 solution (4 layers: ApiLayer, BusinessLayer, DataLayer, DomainModel)
```

### Running Locally (no SQL Server needed)
1. **Backend:** `dotnet run --project backend/ApiLayer` → listens on `http://localhost:5143` (and `https://localhost:7143` with the https profile). `appsettings.Development.json` has `"UseDemoData": true`, which serves generated in-memory data (two report files, 30 min apart) so everything works without SQL Server. Set it to `false` on the machine that has `CENTAUR_DB1_TEST` to use the real database.
2. **Frontend:** `cd frontend && npm install && npm run dev` → `http://localhost:5173`. The API base URL comes from `frontend/.env.development` (`VITE_API_URL=http://localhost:5143`).

### Setting Up on Another Machine
1. **Clone/copy the repo**, then `cd frontend && npm install` (installs from `package.json`; `node_modules/` is gitignored, never committed).
2. **Backend config** — edit `backend/ApiLayer/appsettings.json`:
   - `ConnectionStrings:DefaultConnection` — `Server=.` means "local default SQL Server instance." Change it if this machine's SQL Server has a named instance (`Server=.\SQLEXPRESS`) or is remote.
   - `AllowedOrigins` — CORS is config-driven (see `Program.cs`). Add whatever origin the frontend is actually served from (a different port, a real hostname, etc.) — no rebuild needed, just edit and restart.
   - Leave `UseDemoData` unset/`false` here for real data; it's only `true` in `appsettings.Development.json` for offline dev.
3. **Database** — **there is no `Migrations/` folder in this repo**, so `dotnet ef database update` won't create the schema from scratch. If `CENTAUR_DB1_TEST` (or equivalent) doesn't already exist on this machine, it needs to be created/restored separately — this codebase only reads from `AtmBalanceFile` / `AtmStatusFile`, it doesn't provision them.
4. **Frontend build for something other than the Vite dev server** — set `VITE_API_URL` to point at wherever the backend actually runs before `npm run build` (Vite reads `.env.production` if present, or an environment variable at build time). Without it, the app falls back to `https://localhost:7143`, which is almost certainly wrong on a new machine.
5. **Run it:** `dotnet run --project backend/ApiLayer` (or publish + host in IIS) and `npm run dev` / serve the `dist/` build.

### Two-PC Setup (production path)
- **This PC:** full-stack development (VS Code / Claude Code), demo data mode
- **Other PC:** .NET backend in Visual Studio, connected to the real SQL Server
- Frontend ↔ backend communicate over `https://localhost:7143` / `http://localhost:5143` during development

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
| GET | `/api/atm/comparison?criticalThreshold=20&lowThreshold=50` | `ComparisonResult` | Compares the latest file vs the previous one (see below) |

The first two endpoints return the **most recent snapshot** — latest file only, one row per ATM.

### File-to-File Comparison (backend-computed)

`GET /api/atm/comparison` loads the **two most recent files** of each type and reports what changed:

- **Hardware (`status_comparison`):** per ATM, which device errors were **fixed** (error in previous file, OK now), which are **new**, and which are **ongoing** (including severity changes like Warning → Critical). Also lists ATMs added to / missing from the report, and summary counts (`fixed_count`, `new_count`, `ongoing_count`, `atms_fully_recovered`, `atms_degraded`). Severity decoding is a C# port of the frontend decoder (`backend/BusinessLayer/Decoding/HardwareStatusDecoder.cs`).
- **Balances (`balance_comparison`):** per ATM, previous vs current remaining %, the cash delta, and a classification — **refilled**, **recovered** (was low/critical, healthy now), **went critical**, **still critical**, or dropped. Thresholds are passed as query params so they follow the dashboard's configurable settings.
- If only one file exists, `has_previous_status_file` / `has_previous_balance_file` are `false` and the sections are omitted.

The dashboard shows this as the **"Changes vs Previous Report"** panel (`frontend/src/components/ComparisonPanel.tsx`), refreshed together with the rest of the data.

---

## Frontend Files

All frontend code now lives under `frontend/src/`:

| File | Purpose |
|------|---------|
| `lib/api.ts` | API client — fetch functions + TypeScript interfaces (incl. comparison types) |
| `lib/dataContext.ts` | Snapshot manager — tracks current vs previous data for delta detection |
| `lib/hardwareStatusDecoder.ts` | Decodes 8-char device codes into human-readable status |
| `components/Dashboard.tsx` | Main page — all state, data fetching, charts, layout |
| `components/ComparisonPanel.tsx` | "Changes vs Previous Report" panel fed by `/api/atm/comparison` |
| `components/AtmStatusTable.tsx` | Hardware status table with column filtering and severity sorting |
| `components/AtmBalanceCard.tsx` | Individual ATM balance card with refill/drop delta badge |
| `components/AtmDetailsModal.tsx` | Full-screen ATM detail modal (focus-trapped) |
| `components/HardwareStatusDetail.tsx` | Hardware breakdown component used inside the modal |
| `ATM_STATUS_FILE_FORMAT.md` (repo root) | Full spec for the ATM status file format |
| `CLAUDE_CONTEXT.md` (repo root) | Claude Code context file explaining the project setup |

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

- Full stack now builds and runs on this PC (frontend + backend, demo data mode)
- Frontend: complete — includes the backend-driven "Changes vs Previous Report" comparison panel, Critical Errors bar chart, current-file badge in the header
- Backend: 4-layer .NET 8 solution with the new `/api/atm/comparison` endpoint; `UseDemoData` flag switches between in-memory demo data and SQL Server
- DB: SQL Server `CENTAUR_DB1_TEST` on the other PC (tables created via EF Core migrations); set `"UseDemoData": false` there
- Verified end-to-end on 2026-07-18 with headless-browser screenshots (demo data)

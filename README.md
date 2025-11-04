# SPD eDocument Processing Pipeline

Automated pipeline for transforming employee ZIP bundles from OneDrive into consolidated PDFs, enriching them with HR data, publishing to SharePoint, and emailing daily summaries to stakeholders.

---

## Highlights
- End-to-end automation: download ZIP from OneDrive → extract contents → convert images to PDF → merge and rename → look up employee info → upload to SharePoint → send email summaries.
- Supports mixed content (PDF/JPG/JPEG/PNG/TIFF multi-page) and fails fast on any unsupported file type so the upstream team can correct the package.
- Automatically maintains folder structures on both OneDrive (Archive/Failed) and SharePoint (Role/EmpID).
- Extensive observability: process logs, monthly fail logs, optional Graph API debug traces.
- Sends per-scanner summary emails with attached CSV that includes SharePoint links for every document.

---

## System Flow
```text
OneDrive (Team Folder / Employee Document / Active / Staging)
   │
   ├─ listDriveItems + downloadFile (per team in config/team.json)
   │      ↓
   │  staging/<team>/<zipFile>.zip
   │
   ├─ processZip
   │     ├─ extractZip → temp/<zipName>/*
   │     ├─ convertImageToPdf + convertTiffToPdfs
   │     ├─ mergePdfs → output/<finalPdf>.pdf
   │     └─ buildCsvRowFromZip + getEmployeeInfo (MySQL)
   │
   ├─ uploadPdfToSP + patchSPMetadata → SharePoint (Role/EmpID/<finalPdf>.pdf)
   ├─ moveFileToArchive (OneDrive/Archive/YYYY-MM)
   └─ appendSummaryRow → output/summary.csv

If any error occurs
   ├─ classifyError + appendFailLog (logs/fail_YYYY-MM.csv)
   ├─ moveFileToFailed (OneDrive/Failed/YYYY-MM)
   └─ move original ZIP to staging/<team>/failed/<file>.zip

After each run
   ├─ sendSummaryNotifications → email per scanner + attach daily summary
   └─ cleanupTemporaryDirs → empty staging/, temp/, output/
```

---

## Module Overview
| Path | Responsibility |
| --- | --- |
| `index.js` | Entry point; runs `runPipeline()` and shuts down DB/logger safely. |
| `src/services/processorIndex.js` | Main orchestrator: prepares directories, iterates teams, downloads ZIPs, invokes `processZip`, uploads results, moves files, logs outcomes. |
| `src/services/processor.js` | Handles a single ZIP: image conversion, PDF merge, DB enrichment, CSV row preparation. |
| `src/services/summaryHelper.js` | Manages `output/summary.csv` (schema migration, append, grouping). |
| `src/services/sendSummary.js` | Builds per-scanner summaries, resolves email recipients, sends Graph emails with attachments. |
| `src/core/zip/zipHelper.js` | Extracts ZIP archives and detects password-protected bundles. |
| `src/core/image/imageHelper.js` | Converts images and multi-page TIFFs to PDF. |
| `src/core/pdf/pdfHelper.js` | Merges multiple PDFs into a single document. |
| `src/core/file/fileHelper.js` | Parses ZIP filenames, sorts files, and prepares CSV metadata. |
| `src/core/file/namingHelper.js` | Generates final PDF filenames based on batch window and EmpID. |
| `src/core/db/dbHelper.js` | MySQL access layer with connection pooling and employee lookup. |
| `src/integrations/graphAuth.js` | Microsoft Graph token cache with on-demand refresh. |
| `src/integrations/graphRequest.js` | Axios wrapper for Graph API calls (retry, logging, silent statuses). |
| `src/integrations/graphODHelper.js` | OneDrive helpers: list, download, move to Archive/Failed, delete. |
| `src/integrations/graphSPHelper.js` | SharePoint helpers: ensure folder hierarchy, upload files, patch metadata. |
| `src/integrations/graphUserHelper.js` | Look up users by employeeId via Graph. |
| `src/utils/mailerGraph.js` | Sends emails through Microsoft Graph. |
| `src/utils/mailTemplate.js` | HTML template for summary emails. |
| `src/utils/failLogger.js` | Writes `logs/fail_YYYY-MM.csv` with a categorized error entry. |
| `src/utils/errorTypes.js` | Classifies runtime errors for easier debugging. |
| `mock-generator.js` | Generates sample ZIP files containing PDF/PNG/JPG/TIFF for regression testing. |

---

## Prerequisites
- Node.js **v20 or newer**.
- Environment capable of building native dependencies for `sharp` and `canvas` (e.g., Ubuntu/WSL 22.04, macOS with Xcode tools).
- Connectivity and permissions for Microsoft Graph (OneDrive, SharePoint, Mail) and internal MySQL.

---

## Installation & Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file at the project root (see required variables below).
3. Review `config/team.json`, `config/mapping.json`, and `config/dbConfig.js` so they match your environment.
4. Ensure the working directories exist: `staging/`, `temp/`, `output/`, `logs/` (the pipeline will create them if missing, but provisioning them up front avoids permission surprises).

### Required Environment Variables
| Variable | Description |
| --- | --- |
| `NODE_ENV` | Controls logging destination (`production` writes to file). |
| `LOG_LEVEL` | pino log level (`info`, `debug`, etc.). |
| `MS_TENANT_ID` | Entra tenant ID (GUID). |
| `MS_CLIENT_ID` | Microsoft Graph application (client) ID. |
| `MS_CLIENT_SECRET` | Client secret issued for the Graph app. |
| `MS_OD_DRIVE_ID` | Drive ID of the OneDrive staging area. |
| `MS_SITE_ID` | SharePoint site ID for final storage. |
| `MS_SP_DRIVE_ID` | Document library drive ID on SharePoint. |
| `MAIL_USER` | UPN of the account used to send Graph emails (e.g. `cghrsystem@...`). |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` | MySQL connection parameters. |
| `DEBUG_GRAPH` | Set to `true` to persist Graph responses under `logs/graph/`. |

> Tip: add `TZ=Asia/Bangkok` in `.env` to align timestamps with Thailand local time.

### Configuration Files
- `config/team.json`  
  Maps team display names to OneDrive folders (`team_folder`). Every entry must match the actual directory on OneDrive.
- `config/mapping.json`  
  Maps role and event codes from ZIP filenames to human-readable labels.
- `config/dbConfig.js`  
  Pulls MySQL credentials from `.env` to initialize the pooled connection.

---

## Running the Pipeline
```bash
node index.js
```

Execution summary:
1. Prepare staging/temp/output directories.
2. Load team definitions and iterate each folder.
3. Download ZIP files from OneDrive `Employee Document/Active/Staging`.
4. Call `processZip` for every archive:
   - Extract contents.
   - Convert images to PDF and gather all PDF pages.
   - Fetch employee info from MySQL.
   - Generate final PDF filename (batch window + EmpID + sequence).
5. Upload the merged PDF to SharePoint and patch metadata.
6. Move the original ZIP to OneDrive Archive `{YYYY-MM}`.
7. Append a row to `output/summary.csv`.
8. After all teams finish, send summary emails and clean up staging/temp/output.

Successful runs end with `✅ Pipeline completed successfully!`.

---

## Outputs & Directories
- `staging/<team>/` – downloaded ZIPs; cleaned after each run.
- `staging/<team>/processed/` – original ZIPs that processed successfully.
- `staging/<team>/failed/` – original ZIPs that failed (local backup).
- `temp/<zipName>/` – transient extraction area (emptied after completion).
- `output/summary.csv` – rolling summary consumed by email sender.
- `output/summary_<team>_<scanBy>_<date>.csv` – per-scanner CSV attachments (removed after sending).
- `logs/process.log` – pipeline log file when `NODE_ENV=production`.
- `logs/fail_YYYY-MM.csv` – monthly failure roster with classification.
- `logs/graph/YYYYMMDD.log` – optional Graph API traces when `DEBUG_GRAPH=true`.

---

## Error Handling & Recovery
- All exceptions from `processZip` are captured inside `handleProcessingError`:
  - `classifyError` sets a semantic error type.
  - `appendFailLog` writes the event to `logs/fail_YYYY-MM.csv`.
  - Source ZIP is moved to OneDrive `Failed/YYYY-MM` and to local `staging/<team>/failed`.
  - A failed record is appended to `output/summary.csv`.
- Unsupported file types now throw immediately, forcing the bundle to be fixed before reprocessing.
- Any DB or Graph error is re-thrown with response details to aid troubleshooting.
- The orchestrator continues with other teams even if one ZIP fails (fail-fast per file, not per batch).

### Recovery Checklist
1. Inspect `logs/fail_YYYY-MM.csv` to identify the error type and file.
2. Correct the source ZIP (content, naming, permissions, etc.).
3. Place the fixed ZIP back into the OneDrive staging folder.
4. Re-run `node index.js` (already processed items are in Archive and will not be re-picked).

---

## Notifications
- `sendSummaryNotifications` groups summary rows by team + scanner.
- Email subject: `📊 [HRIS] : <team> eDocument Summary - <YYYY-MM-DD>`.
- The HTML body includes success/failure counts and details about the attached CSV.
- If the scanner’s email cannot be resolved, the message falls back to `cghrsystem@central.co.th`.

---

## Utilities & Developer Scripts
- `node mock-generator.js`  
  Creates realistic ZIP samples (PDF + PNG + JPG + multi-page TIFF) inside `staging/` for local regression.
- `src/tests/testGraphAuth.js`  
  Quick sanity check that a Graph access token can be retrieved.
- `src/tests/testGraphHelper.js`  
  Sample script to list and download ZIPs from OneDrive (adjust paths before using).

---

## Development Tips & Troubleshooting
- Set `LOG_LEVEL=debug` to get rich console output via `pino-pretty` in development.
- Call `clearTokenCache()` or delete `.cache/ms_token.json` if you need to force a new Graph token.
- Required Graph app permissions (minimum):
  - OneDrive: `Files.ReadWrite.All`
  - SharePoint: `Sites.Selected` or `Sites.ReadWrite.All`
  - Mail: `Mail.Send`
  - Users: `User.Read.All`
- `sharp` and `canvas` may require additional system packages (`build-essential`, `libvips`, Xcode CLI tools). Follow each library’s installation guide when building on new hosts.
- Investigate `Employee not found` errors by verifying HR data and the ZIP naming convention.
- Schedule the pipeline via cron (Linux) or Task Scheduler (Windows) as needed.

---

## Roadmap / TODO
- [ ] Send a monthly failure digest to `cghrsystem@central.co.th`.
- [ ] Add automated unit/integration tests for critical helpers.
- [ ] Build a health-check script for Graph connectivity and database access.

---

Thank you for using the SPD eDocument Automation pipeline. For issues or enhancement requests, reach out to the HRIS team or the development maintainers.

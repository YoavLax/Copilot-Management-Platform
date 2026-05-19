# GitHub Copilot Usage Extended Insights

A dark GitHub-style dashboard for monitoring enterprise-wide GitHub Copilot usage — per engineer, per model, with daily trends and cost estimates.

## Features

- **Overview page** — summary cards: active users, interactions, chat/agent requests, LOC added, estimated cost
- **Detailed Report** — paginated, sortable, filterable per-user table with model breakdown
- **Model Breakdown** — bar + pie charts showing usage and cost split by model
- **User Drilldown** — side panel with daily trend chart, model usage breakdown, and summary stats
- **Data Pipeline** — ingestion run history and manual trigger
- **Demo mode** — works out of the box with mock data (no GitHub token required)

## Quick Start (Docker)

```bash
cp .env.example .env
docker-compose up -d
```

Open [http://localhost](http://localhost) — the dashboard runs in demo mode by default.

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (or use the Docker Compose service)
- npm

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DEMO_MODE=true for mock data, or add a real GITHUB_TOKEN
```

### 3. Start PostgreSQL

```bash
docker-compose up -d postgres
```

### 4. Push database schema

```bash
npm run db:push
```

### 5. Start everything

```bash
npm run dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:5173

## Real GitHub Integration

To connect to real GitHub Enterprise data:

1. Create a [GitHub App](https://docs.github.com/en/apps/creating-github-apps) or a fine-grained PAT with:
   - `Enterprise Copilot metrics: read`
   - Or classic: `manage_billing:copilot` / `read:enterprise`

2. In `.env`:
   ```
   DEMO_MODE=false
   GITHUB_TOKEN=your_token
   GITHUB_ENTERPRISE_SLUG=your-enterprise-slug
   ```

3. Restart the backend — ingestion will run at startup and daily at 06:00 UTC.

## Architecture

```
GitHub Enterprise APIs
         │
         ▼
Ingestion Worker (node-cron)
         │
         ▼
PostgreSQL (Prisma)
         │
         ▼
Express API (/api/copilot/usage/*)
         │
         ▼
React Dashboard (Vite + Tailwind + Recharts)
```

## Database Schema

| Table | Purpose |
|---|---|
| `ingestion_runs` | Tracks every data fetch — idempotent by enterprise+day+type |
| `raw_reports` | Stores raw GitHub API payloads for debugging |
| `copilot_usage_daily_user_model` | Normalized fact table: one row per user+model+ide+feature+day |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/copilot/usage/summary` | Aggregate totals + top models |
| GET | `/api/copilot/usage/users` | Paginated per-user table |
| GET | `/api/copilot/usage/users/:login/models` | Per-model breakdown for a user |
| GET | `/api/copilot/usage/users/:login/daily` | Daily trend for a user |
| GET | `/api/copilot/usage/models` | List of distinct models |
| GET | `/api/copilot/usage/organizations` | List of distinct orgs |
| GET | `/api/copilot/usage/ingestion-runs` | Recent ingestion history |
| POST | `/api/copilot/usage/ingest` | Manually trigger ingestion |

## Open Questions (from design doc)

Validate these against a real enterprise before v1 launch:

1. Exact field names in enterprise users report
2. Model usage availability per user per day
3. Token counts vs interaction counts
4. Billing API availability at enterprise level
5. Report file format (JSON vs NDJSON)

See `backend/src/github/client.ts` — the `CopilotUsageReportRow` interface will need updating after inspecting real report files.

## Future Extensions

- Budget visualization per engineer
- Anomaly detection (sudden Opus spike, cost threshold)
- Email / Teams alerts
- Manager-level views
- RBAC (Viewer / Manager / Admin / Billing Admin)
- Export to CSV

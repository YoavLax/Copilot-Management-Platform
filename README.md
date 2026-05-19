# GitHub Copilot Management Console

An open-source dashboard for monitoring GitHub Copilot adoption, usage, model mix, and ingestion health across an enterprise or multi-org environment.

The project ships with a demo mode so the UI can be explored without live GitHub credentials. All screenshots in this repository use fake data.

## Highlights

- Dashboard overview for seats, activity, editor distribution, and model usage
- Detailed per-user reporting with filters and model drilldowns
- Budget management workflows for users and teams
- Ingestion controls and run history for seat sync and model usage import
- Demo mode for local evaluation without real enterprise data
- Backend API and Prisma schema ready for extension

## Screenshots

### Overview

![Overview screenshot](docs/screenshots/overview.png)

### Detailed Report

![Detailed report screenshot](docs/screenshots/report.png)

### Data Pipeline

![Data pipeline screenshot](docs/screenshots/pipeline.png)

### Budget Management

![Budget management screenshot](docs/screenshots/budgets.png)

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind, Recharts
- Backend: Node.js, Express, TypeScript, Prisma
- Database: PostgreSQL
- Scheduling: node-cron

## Quick Start

### Docker

```bash
cp .env.example .env
docker-compose up -d
```

Open http://localhost.

### Local Development

Prerequisites:

- Node.js 20+
- PostgreSQL 14+
- npm

Install dependencies:

```bash
npm install
```

Create local configuration:

```bash
cp .env.example .env
```

Initialize the database:

```bash
docker-compose up -d postgres
npm run db:push
```

Run the app:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Configuration

The main configuration lives in `.env`. Start from [.env.example](.env.example).

Common settings:

- `DEMO_MODE=true` runs the UI against demo-friendly flows
- `GITHUB_TOKEN` supplies GitHub API access for real data ingestion
- `GITHUB_ENTERPRISE_SLUG` selects the enterprise slug shown in the app chrome
- `GITHUB_ORG` or `GITHUB_ORGS` can be used for single-org or multi-org setups
- `DATABASE_URL` points Prisma to PostgreSQL

## Real GitHub Integration

To connect the app to live enterprise data:

1. Create a GitHub App or fine-grained PAT with the required enterprise Copilot permissions.
2. Set the following in `.env`:

```env
DEMO_MODE=false
GITHUB_TOKEN=your_token
GITHUB_ENTERPRISE_SLUG=your-enterprise-slug
```

3. Restart the backend so scheduled ingestion and startup sync can pick up the new configuration.

## Architecture

```text
GitHub Enterprise APIs
         |
         v
Ingestion Worker
         |
         v
PostgreSQL via Prisma
         |
         v
Express API
         |
         v
React Dashboard
```

## Data Model

Key tables:

| Table | Purpose |
|---|---|
| `ingestion_runs` | Tracks each seat or metrics ingestion run |
| `raw_reports` | Stores raw payloads for troubleshooting |
| `copilot_usage_daily_user_model` | Normalized per-user, per-model usage facts |

## API Surface

Representative endpoints:

| Method | Path | Description |
|---|---|---|
| GET | `/api/copilot/config` | UI-safe runtime config such as enterprise slug |
| GET | `/api/copilot/summary` | Aggregate seat and activity summary |
| GET | `/api/copilot/seats` | Paginated seat report |
| GET | `/api/copilot/model-usage/summary` | Aggregate model usage metrics |
| GET | `/api/copilot/ingestion-runs` | Recent ingestion history |
| POST | `/api/copilot/ingest` | Trigger seat ingestion |
| POST | `/api/copilot/model-usage/import` | Trigger model usage sync |

## Open Source Notes

- License: [MIT](LICENSE)
- Contributing guide: [CONTRIBUTING.md](CONTRIBUTING.md)

## Documentation Assets

The screenshots in this README intentionally use fake data.

## Roadmap Ideas

- Export and scheduled report delivery
- Alerting for usage anomalies and budget thresholds
- Additional RBAC roles and audit views
- More deployment options and production hardening guidance

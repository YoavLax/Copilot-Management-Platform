# Contributing

## Getting Started

1. Fork the repository and create a feature branch from `main`.
2. Copy `.env.example` to `.env` and keep secrets out of source control.
3. Install dependencies with `npm install`.
4. Start the stack with either `docker-compose up -d` or `npm run dev` after provisioning PostgreSQL.

## Development Guidelines

- Keep changes focused and minimal.
- Prefer fixing root causes over adding UI-only or one-off patches.
- Update documentation when behavior, setup, or API contracts change.
- Do not commit secrets, private datasets, or customer-identifying screenshots.
- Use fake or demo data for docs and screenshots.

## Validation

Run the relevant checks before opening a pull request:

```bash
npm run build --workspace=backend
npm run build --workspace=frontend
```

If you modify database schema or ingestion behavior, also verify the affected flow locally.

## Pull Requests

When opening a pull request:

- Describe the user-facing impact and implementation approach.
- Call out any config, migration, or rollout requirements.
- Include screenshots for UI changes when practical.
- Keep unrelated refactors out of the same pull request.

## Reporting Issues

Use GitHub issues for bugs and feature requests.
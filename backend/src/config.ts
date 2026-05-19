import path from 'path';
import dotenv from 'dotenv';

// __dirname = backend/src — load from repo root first, then fall back to local
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // no-op if already loaded; picks up backend/.env if present

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  github: {
    token: process.env.GITHUB_TOKEN ?? '',
    enterpriseSlug: process.env.GITHUB_ENTERPRISE_SLUG ?? '',
    org: process.env.GITHUB_ORG ?? '',
    // GITHUB_ORGS takes precedence; falls back to GITHUB_ORG for single-org setups
    orgs: process.env.GITHUB_ORGS
      ? process.env.GITHUB_ORGS.split(',').map((s) => s.trim()).filter(Boolean)
      : process.env.GITHUB_ORG
        ? [process.env.GITHUB_ORG]
        : [],
  },
  ingestion: {
    cron: process.env.INGESTION_CRON ?? '0 6 * * *',
  },
  demoMode: process.env.DEMO_MODE === 'true',
};

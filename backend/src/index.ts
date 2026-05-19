import 'dotenv/config';
import cron from 'node-cron';
import { createApp } from './api/app';
import { config } from './config';
import { logger } from './lib/logger';
import { runIngestion, runUsageMetricsIngestion, runDailyUsageIngestion } from './worker/ingestion';
import { prisma } from './db/client';

async function main() {
  logger.info('Starting GitHub Copilot Seat Insights', {
    env: config.nodeEnv,
    org: config.github.org,
    port: config.port,
  });

  // Database connectivity check
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connected');
  } catch (err) {
    logger.error('Database connection failed', { error: err });
    process.exit(1);
  }

  // Run ingestion on startup if no seats are loaded yet
  const seatCount = await prisma.copilotSeat.count();
  if (seatCount === 0 && config.github.token && config.github.org) {
    logger.info('No seat data found — running initial ingestion...');
    await runIngestion();
  }

  // Run usage metrics ingestion on startup if no usage data exists
  if (config.github.enterpriseSlug && config.github.token) {
    const usageCount = await prisma.userModelUsage.count();
    if (usageCount === 0) {
      logger.info('No usage data found — running initial usage metrics ingestion (current month)...');
      await runUsageMetricsIngestion(config.github.enterpriseSlug);
    }
  }

  // Schedule daily ingestion (seats + yesterday's usage delta)
  cron.schedule(config.ingestion.cron, async () => {
    logger.info('Running scheduled ingestion');
    await runIngestion();
    if (config.github.enterpriseSlug) {
      await runDailyUsageIngestion(config.github.enterpriseSlug);
    }
  });

  // Start HTTP server
  const app = createApp();
  app.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port}`);
  });
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err });
  process.exit(1);
});

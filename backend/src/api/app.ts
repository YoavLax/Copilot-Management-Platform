import express, { Request, Response, NextFunction } from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '../config';
import { logger } from '../lib/logger';
import usageRouter from './routes/usage';
import modelUsageRouter from './routes/modelUsage';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json());

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), demoMode: config.demoMode });
  });

  // API routes
  app.use('/api/copilot', usageRouter);
  app.use('/api/copilot/model-usage', modelUsageRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    logger.error('Unhandled error', { error: message });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

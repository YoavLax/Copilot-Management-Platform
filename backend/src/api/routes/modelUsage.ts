import { Router, Request, Response } from 'express';
import { prisma } from '../../db/client';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { runUsageMetricsIngestion } from '../../worker/ingestion';

const router = Router();

function getCurrentMonthUsageWhere() {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  return {
    day: {
      gte: start,
      lte: end,
    },
  };
}

function getCurrentMonthUsageRange() {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

// ── POST /api/copilot/model-usage/import ───────────────────────────────
// Triggers a live current-month usage metrics sync from the GitHub Copilot metrics API.

router.post('/import', async (_req: Request, res: Response) => {
  const enterprise = config.github.enterpriseSlug;
  if (!enterprise) {
    return res.status(400).json({ error: 'GITHUB_ENTERPRISE_SLUG is not configured.' });
  }
  logger.info('Starting on-demand usage metrics sync', { enterprise });
  const result = await runUsageMetricsIngestion(enterprise);
  if (!result.success) {
    return res.status(500).json({ error: result.error });
  }
  return res.json({ success: true, recordsLoaded: result.recordsProcessed });
});

// ── GET /api/copilot/model-usage/status ────────────────────────────────
// Returns the last import run info.

router.get('/status', async (_req: Request, res: Response) => {
  const lastImport = await prisma.usageImportRun.findFirst({
    orderBy: { importedAt: 'desc' },
  });
  const totalRows = await prisma.userModelUsage.count();
  return res.json({ lastImport, totalRows });
});

// ── GET /api/copilot/model-usage/summary ──────────────────────────────
// Returns aggregate stats + top models.

router.get('/summary', async (_req: Request, res: Response) => {
  const usageWhere = getCurrentMonthUsageWhere();
  const usageRange = getCurrentMonthUsageRange();
  const [byModel, lastImport, totalInteractionsAgg] = await Promise.all([
    prisma.userModelUsage.groupBy({
      by: ['model'],
      where: usageWhere,
      _sum: { interactions: true, codeGenCount: true, locSuggestedAdd: true, locAdded: true },
      _count: { userLogin: true },
      orderBy: { _sum: { interactions: 'desc' } },
    }),
    prisma.usageImportRun.findFirst({ orderBy: { importedAt: 'desc' } }),
    prisma.userModelUsage.aggregate({
      where: usageWhere,
      _sum: { interactions: true, locSuggestedAdd: true, locAdded: true },
    }),
  ]);

  // Distinct users per model (group by model+userLogin, then count distinct per model)
  const usersByModel = await prisma.userModelUsage.groupBy({
    by: ['model', 'userLogin'],
    where: usageWhere,
    _sum: { interactions: true },
  });
  const modelUserCount: Record<string, Set<string>> = {};
  for (const row of usersByModel) {
    if (!modelUserCount[row.model]) modelUserCount[row.model] = new Set();
    modelUserCount[row.model].add(row.userLogin);
  }

  const topModels = byModel.map((m) => ({
    model: m.model,
    interactions: m._sum.interactions ?? 0,
    codeGenCount: m._sum.codeGenCount ?? 0,
    locSuggestedAdd: m._sum.locSuggestedAdd ?? 0,
    locAdded: m._sum.locAdded ?? 0,
    users: modelUserCount[m.model]?.size ?? 0,
  }));

  const distinctUsers = await prisma.userModelUsage.findMany({
    where: usageWhere,
    distinct: ['userLogin'],
    select: { userLogin: true },
  });

  return res.json({
    totalInteractions: totalInteractionsAgg._sum.interactions ?? 0,
    locSuggestedAdd: totalInteractionsAgg._sum.locSuggestedAdd ?? 0,
    locAdded: totalInteractionsAgg._sum.locAdded ?? 0,
    uniqueUsers: distinctUsers.length,
    uniqueModels: byModel.length,
    dateFrom: usageRange.from,
    dateTo: usageRange.to,
    lastImport: lastImport ? { importedAt: lastImport.importedAt, recordsLoaded: lastImport.recordsLoaded } : null,
    topModels,
  });
});

// ── GET /api/copilot/model-usage/users ────────────────────────────────
// Per-user aggregated model usage stats.
// Query params: search, primaryModel, sort (interactions_desc | locAdded_desc | acceptance_desc | user_asc), page, pageSize

router.get('/users', async (req: Request, res: Response) => {
  const search = (req.query.search as string) ?? '';
  const primaryModel = (req.query.primaryModel as string) ?? '';
  const sort = (req.query.sort as string) ?? 'interactions_desc';
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
  const pageSize = Math.min(2000, Math.max(5, parseInt((req.query.pageSize as string) ?? '25', 10)));
  const usageWhere = getCurrentMonthUsageWhere();

  // Fetch per-user-model aggregates
  const [byUserModel, byUserFeature] = await Promise.all([
    prisma.userModelUsage.groupBy({
      by: ['userLogin', 'userId', 'model'],
      where: usageWhere,
      _sum: { interactions: true, codeGenCount: true, codeAcceptCount: true, locSuggestedAdd: true, locAdded: true },
    }),
    prisma.userModelUsage.groupBy({
      by: ['userLogin', 'feature'],
      where: usageWhere,
      _sum: { interactions: true },
    }),
  ]);

  // Aggregate per user in JS
  type UserStats = {
    userLogin: string;
    userId: number | null;
    totalInteractions: number;
    codeGenCount: number;
    codeAcceptCount: number;
    locSuggestedAdd: number;
    locAdded: number;
    models: { model: string; interactions: number }[];
    primaryModel: string | null;
    chatInteractions: number;
    agentInteractions: number;
    acceptanceRate: number;
  };

  const userMap = new Map<string, UserStats>();

  for (const row of byUserModel) {
    const interactions = row._sum.interactions ?? 0;
    if (!userMap.has(row.userLogin)) {
      userMap.set(row.userLogin, {
        userLogin: row.userLogin,
        userId: row.userId ?? null,
        totalInteractions: 0,
        codeGenCount: 0,
        codeAcceptCount: 0,
        locSuggestedAdd: 0,
        locAdded: 0,
        models: [],
        primaryModel: null,
        chatInteractions: 0,
        agentInteractions: 0,
        acceptanceRate: 0,
      });
    }
    const u = userMap.get(row.userLogin)!;
    u.totalInteractions += interactions;
    u.codeGenCount += row._sum.codeGenCount ?? 0;
    u.codeAcceptCount += row._sum.codeAcceptCount ?? 0;
    u.locSuggestedAdd += row._sum.locSuggestedAdd ?? 0;
    u.locAdded += row._sum.locAdded ?? 0;
    u.models.push({ model: row.model, interactions });
  }

  // Add feature breakdown
  for (const row of byUserFeature) {
    const u = userMap.get(row.userLogin);
    if (!u) continue;
    const feature = row.feature;
    const n = row._sum.interactions ?? 0;
    if (feature.startsWith('chat_panel')) u.chatInteractions += n;
    if (feature === 'chat_panel_agent_mode') u.agentInteractions += n;
  }

  // Finalize: sort models, set primary, compute acceptance rate
  for (const u of userMap.values()) {
    u.models.sort((a, b) => b.interactions - a.interactions);
    u.primaryModel = u.models[0]?.model ?? null;
    u.acceptanceRate = u.locSuggestedAdd > 0
      ? Math.min(100, Math.round((u.locAdded / u.locSuggestedAdd) * 100))
      : 0;
  }

  let users = [...userMap.values()];

  // Filter
  if (search) users = users.filter((u) => u.userLogin.toLowerCase().includes(search.toLowerCase()));
  if (primaryModel) users = users.filter((u) => u.primaryModel === primaryModel || u.models.some((m) => m.model === primaryModel));

  // Sort
  switch (sort) {
    case 'interactions_desc': users.sort((a, b) => b.totalInteractions - a.totalInteractions); break;
    case 'locAdded_desc': users.sort((a, b) => b.locAdded - a.locAdded); break;
    case 'locSuggested_desc': users.sort((a, b) => b.locSuggestedAdd - a.locSuggestedAdd); break;
    case 'acceptance_desc': users.sort((a, b) => b.acceptanceRate - a.acceptanceRate); break;
    case 'user_asc': users.sort((a, b) => a.userLogin.localeCompare(b.userLogin)); break;
    default: users.sort((a, b) => b.totalInteractions - a.totalInteractions);
  }

  const total = users.length;
  const paged = users.slice((page - 1) * pageSize, page * pageSize);

  return res.json({ total, page, pageSize, users: paged });
});

// ── GET /api/copilot/model-usage/models ──────────────────────────────
// Distinct model names (for filter dropdown)

router.get('/models', async (_req: Request, res: Response) => {
  const rows = await prisma.userModelUsage.findMany({
    where: getCurrentMonthUsageWhere(),
    distinct: ['model'],
    select: { model: true },
    orderBy: { model: 'asc' },
  });
  return res.json(rows.map((r) => r.model));
});

export default router;

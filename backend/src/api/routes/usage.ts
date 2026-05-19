import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client';
import { runIngestion } from '../../worker/ingestion';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { differenceInDays } from 'date-fns';

/**
 * Normalise editor into a grouped, stable key for the editor distribution chart.
 * Falls back to parsing lastActivityEditor when editorName is 'unknown' or empty,
 * so we can distinguish "Unknown IDE using Copilot Chat" from "no activity".
 */
function normalizeEditor(editorName: string | null, lastActivityEditor: string | null): string {
  const name = editorName?.trim() ?? '';
  const raw  = lastActivityEditor?.trim().toLowerCase() ?? '';

  if (name && name !== 'unknown') {
    const l = name.toLowerCase();
    if (l.startsWith('jetbrains')) return 'jetbrains';
    if (l === 'copilot_pr_review' || l === 'copilot_pull_request_review') return 'copilot-pr-review';
    if (l.startsWith('copilot-cli')) return 'copilot-cli';
    if (l.startsWith('copilot-chat-platform')) return 'copilot-chat-platform';
    if (l.startsWith('copilot-developer')) return 'copilot-developer';
    return name;
  }

  // editorName is 'unknown' or blank — parse lastActivityEditor for more detail.
  // Format: "{editor}/{plugin}/{version}"
  if (raw.startsWith('unknown/githubcopilotchat/') || raw.startsWith('unknown/copilot-chat/')) {
    return 'unknown-chat';
  }
  if (raw.startsWith('unknown/githubcopilot/') || raw.startsWith('unknown/copilot/')) {
    return 'unknown-completions';
  }
  if (!raw) return 'no-activity';
  return 'unknown';
}

/**
 * Classify last_activity_editor raw string into a Copilot feature/product.
 * e.g. "vscode/1.118.1/copilot-chat/0.46.2" → "IDE Chat"
 *      "copilot_pr_review"                   → "PR Review"
 */
function classifyFeature(raw: string | null): string {
  if (!raw) return 'Unknown';
  const l = raw.toLowerCase();
  if (l.includes('copilot_pr_review')) return 'PR Review';
  if (l.includes('copilot-cli') || l === 'copilot-cli') return 'Copilot CLI';
  if (l.includes('copilot-chat-platform')) return 'GitHub.com Chat';
  if (l.includes('copilot-developer')) return 'Extensions / API';
  if (l.includes('copilot-chat')) return 'IDE Chat';
  if (l.startsWith('vscode') || l.startsWith('visualstudio') || l.startsWith('jetbrains') ||
      l.startsWith('vim') || l.startsWith('neovim') || l.startsWith('xcode') || l.startsWith('emacs')) {
    return 'IDE Completions';
  }
  return 'Other';
}

const router = Router();

// ── GET /api/copilot/summary ────────────────────────────────────────────

router.get('/summary', async (req: Request, res: Response) => {
  const orgFilter = req.query.org as string | undefined;
  const orgWhere = orgFilter && orgFilter !== 'all' ? { orgSlug: orgFilter } : {};

  // For snapshot: aggregate the latest snapshot per org (sum totals), or single org if filtered
  let snapshot: {
    totalSeats: number;
    activeThisCycle: number;
    inactiveThisCycle: number;
    pendingCancellation: number;
  } | null = null;

  if (orgFilter && orgFilter !== 'all') {
    const s = await prisma.orgBillingSnapshot.findFirst({
      where: { orgSlug: orgFilter },
      orderBy: { snapshotAt: 'desc' },
    });
    if (s) snapshot = s;
  } else {
    // Get latest snapshot per org, then sum billing cycle metrics
    const allOrgs = await prisma.orgBillingSnapshot.findMany({
      distinct: ['orgSlug'],
      orderBy: { snapshotAt: 'desc' },
    });

    // Use actual distinct userLogin count as totalSeats to avoid double-counting
    // (some orgs appear under '_unknown' AND a named org in the same enterprise fetch)
    const uniqueSeatsCount = await prisma.copilotSeat.findMany({
      distinct: ['userLogin'],
      select: { userLogin: true },
    });

    const billingTotals = allOrgs.reduce(
      (acc, s) => ({
        activeThisCycle: acc.activeThisCycle + s.activeThisCycle,
        inactiveThisCycle: acc.inactiveThisCycle + s.inactiveThisCycle,
        pendingCancellation: acc.pendingCancellation + s.pendingCancellation,
      }),
      { activeThisCycle: 0, inactiveThisCycle: 0, pendingCancellation: 0 }
    );

    snapshot = {
      totalSeats: uniqueSeatsCount.length,
      ...billingTotals,
    };
  }

  const lastRun = await prisma.ingestionRun.findFirst({
    where: { status: 'success', ...(orgFilter && orgFilter !== 'all' ? { orgSlug: orgFilter } : {}) },
    orderBy: { completedAt: 'desc' },
  });

  // Fetch all seat rows and deduplicate per user (keep the row with the most recent
  // lastActivityAt per userLogin). This prevents double-counting users who hold seats
  // in more than one org.
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.toDateString());

  const allSeatRows = await prisma.copilotSeat.findMany({
    where: orgWhere,
    select: { userLogin: true, editorName: true, lastActivityEditor: true, lastActivityAt: true },
  });

  const userBest = new Map<string, typeof allSeatRows[0]>();
  for (const row of allSeatRows) {
    const existing = userBest.get(row.userLogin);
    const existingTime = existing?.lastActivityAt?.getTime() ?? 0;
    const rowTime = row.lastActivityAt?.getTime() ?? 0;
    if (!existing || rowTime > existingTime) userBest.set(row.userLogin, row);
  }
  const deduped = Array.from(userBest.values());

  // Activity counts from deduplicated seats
  let activeToday = 0, activeWeek = 0, activeMonth = 0, neverActive = 0;
  for (const seat of deduped) {
    const t = seat.lastActivityAt?.getTime() ?? null;
    if (t === null) { neverActive++; continue; }
    if (t >= todayStart.getTime()) activeToday++;
    if (t >= sevenDaysAgo.getTime()) activeWeek++;
    if (t >= thirtyDaysAgo.getTime()) activeMonth++;
  }

  // Editor breakdown from deduplicated seats (normalised + grouped)
  const editorMap = new Map<string, number>();
  for (const seat of deduped) {
    const e = normalizeEditor(seat.editorName, seat.lastActivityEditor);
    editorMap.set(e, (editorMap.get(e) ?? 0) + 1);
  }
  const editors = Array.from(editorMap.entries())
    .map(([editor, seats]) => ({ editor, seats }))
    .filter((e) => e.editor !== 'no-activity')
    .sort((a, b) => b.seats - a.seats);

  // Feature breakdown from deduplicated seats
  const featureMap = new Map<string, number>();
  for (const seat of deduped) {
    const f = classifyFeature(seat.lastActivityEditor);
    featureMap.set(f, (featureMap.get(f) ?? 0) + 1);
  }
  const features = Array.from(featureMap.entries())
    .map(([feature, seats]) => ({ feature, seats }))
    .sort((a, b) => b.seats - a.seats);

  return res.json({
    snapshot,
    lastSyncAt: lastRun?.completedAt ?? null,
    activity: { activeToday, activeWeek, activeMonth, neverActive },
    editors,
    features,
  });
});

// ── GET /api/copilot/seats ──────────────────────────────────────────────

const seatsQuerySchema = z.object({
  search: z.string().optional(),
  editor: z.string().optional(),
  org: z.string().optional(),
  status: z.enum(['active', 'recent', 'dormant', 'never', 'all']).optional().default('all'),
  sort: z.enum(['lastActivityAt_desc', 'lastActivityAt_asc', 'userLogin_asc', 'seatCreatedAt_desc']).optional().default('lastActivityAt_desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(2000).default(25),
});

router.get('/seats', async (req: Request, res: Response) => {
  const parsed = seatsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
  }

  const { search, editor, org, status, sort, page, pageSize } = parsed.data;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const where: Record<string, unknown> = {};

  if (search) {
    where.userLogin = { contains: search, mode: 'insensitive' };
  }
  if (editor && editor !== 'all') {
    where.editorName = editor;
  }
  if (org && org !== 'all') {
    where.orgSlug = org;
  }
  if (status === 'active') {
    where.lastActivityAt = { gte: sevenDaysAgo };
  } else if (status === 'recent') {
    where.lastActivityAt = { gte: thirtyDaysAgo, lt: sevenDaysAgo };
  } else if (status === 'dormant') {
    where.lastActivityAt = { lt: thirtyDaysAgo };
  } else if (status === 'never') {
    where.lastActivityAt = null;
  }

  const orderBy: Record<string, string> = {};
  if (sort === 'lastActivityAt_desc') orderBy.lastActivityAt = 'desc';
  else if (sort === 'lastActivityAt_asc') orderBy.lastActivityAt = 'asc';
  else if (sort === 'userLogin_asc') orderBy.userLogin = 'asc';
  else if (sort === 'seatCreatedAt_desc') orderBy.createdAt = 'desc';

  // Fetch ALL rows matching filters (max ~1200 seats), deduplicate per user in JS.
  // A user can hold a seat in multiple orgs — we keep the most recently active record.
  const allRows = await prisma.copilotSeat.findMany({ where });

  const userMap = new Map<string, typeof allRows[0]>();
  for (const row of allRows) {
    const existing = userMap.get(row.userLogin);
    if (!existing) {
      userMap.set(row.userLogin, row);
    } else {
      const existingTime = existing.lastActivityAt?.getTime() ?? 0;
      const rowTime = row.lastActivityAt?.getTime() ?? 0;
      if (rowTime > existingTime) userMap.set(row.userLogin, row);
    }
  }

  // Unified row shape (seat rows + synthetic enterprise-only rows)
  type UnifiedRow = {
    id: string;
    orgSlug: string;
    userLogin: string;
    userId: number | null;
    lastActivityAt: Date | null;
    lastActivityEditor: string | null;
    lastAuthenticatedAt: Date | null;
    pendingCancellationDate: Date | null;
    planType: string | null;
    editorName: string | null;
    editorVersion: string | null;
    createdAt: Date;
    syncedAt: Date;
  };

  let deduped: UnifiedRow[] = [...userMap.values()];

  // ── Append enterprise-only users (model usage but no org seat) ──────────
  // Only when no org or editor filter is active — these users have no org/editor info.
  if (!editor && (!org || org === 'all')) {
    const seatLogins = new Set(deduped.map((r) => r.userLogin));

    const unseatedWhere: Record<string, unknown> = {};
    if (search) unseatedWhere.userLogin = { contains: search, mode: 'insensitive' };

    const unseatedGroups = await prisma.userModelUsage.groupBy({
      by: ['userLogin', 'userId'],
      _max: { day: true },
      _min: { day: true },
      where: Object.keys(unseatedWhere).length ? unseatedWhere : undefined,
    });

    for (const u of unseatedGroups) {
      if (seatLogins.has(u.userLogin)) continue;

      const lastDay = u._max.day!;
      const daysSince = differenceInDays(now, lastDay);

      // Apply status filter
      if (status === 'active' && daysSince > 7) continue;
      if (status === 'recent' && (daysSince <= 7 || daysSince > 30)) continue;
      if (status === 'dormant' && daysSince <= 30) continue;
      if (status === 'never') continue; // enterprise users always have usage

      deduped.push({
        id: `_ent_${u.userLogin}`,
        orgSlug: '_enterprise',
        userLogin: u.userLogin,
        userId: u.userId ?? null,
        lastActivityAt: lastDay,
        lastActivityEditor: null,
        lastAuthenticatedAt: null,
        pendingCancellationDate: null,
        planType: 'enterprise',
        editorName: null,
        editorVersion: null,
        createdAt: u._min.day!,
        syncedAt: now,
      });
    }
  }

  // Sort after deduplication
  if (sort === 'lastActivityAt_desc') deduped.sort((a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0));
  else if (sort === 'lastActivityAt_asc') deduped.sort((a, b) => (a.lastActivityAt?.getTime() ?? 0) - (b.lastActivityAt?.getTime() ?? 0));
  else if (sort === 'userLogin_asc') deduped.sort((a, b) => a.userLogin.localeCompare(b.userLogin));
  else if (sort === 'seatCreatedAt_desc') deduped.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = deduped.length;
  const rows = deduped.slice((page - 1) * pageSize, page * pageSize);

  const items = rows.map((s) => {
    const daysSince = s.lastActivityAt ? differenceInDays(now, s.lastActivityAt) : null;
    let activityStatus: string;
    if (daysSince === null) activityStatus = 'never';
    else if (daysSince <= 7) activityStatus = 'active';
    else if (daysSince <= 30) activityStatus = 'recent';
    else activityStatus = 'dormant';

    return {
      userLogin: s.userLogin,
      userId: s.userId,
      lastActivityAt: s.lastActivityAt?.toISOString() ?? null,
      lastActivityEditor: s.lastActivityEditor,
      lastAuthenticatedAt: s.lastAuthenticatedAt?.toISOString() ?? null,
      pendingCancellationDate: s.pendingCancellationDate?.toISOString() ?? null,
      planType: s.planType,
      editorName: s.editorName,
      editorVersion: s.editorVersion,
      seatCreatedAt: s.createdAt.toISOString(),
      orgSlug: s.orgSlug,
      syncedAt: s.syncedAt.toISOString(),
      activityStatus,
      daysSinceActive: daysSince,
      feature: classifyFeature(s.lastActivityEditor),
      isSeated: s.orgSlug !== '_enterprise',
    };
  });

  return res.json({ page, pageSize, total, items });
});

// ── GET /api/copilot/editors ────────────────────────────────────────────

router.get('/editors', async (_req: Request, res: Response) => {
  const editors = await prisma.copilotSeat.groupBy({
    by: ['editorName'],
    _count: { editorName: true },
    orderBy: { _count: { editorName: 'desc' } },
  });
  return res.json(editors.map((e) => e.editorName ?? 'unknown').filter(Boolean));
});

// ── GET /api/copilot/orgs ───────────────────────────────────────────────

router.get('/orgs', async (_req: Request, res: Response) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Read distinct orgs from DB (covers all enterprise orgs, not just configured ones)
  const distinct = await prisma.copilotSeat.findMany({
    distinct: ['orgSlug'],
    select: { orgSlug: true },
  });
  const orgs = distinct.map((d) => d.orgSlug);

  const results = await Promise.all(
    orgs.map(async (org) => {
      const snapshot = await prisma.orgBillingSnapshot.findFirst({
        where: { orgSlug: org },
        orderBy: { snapshotAt: 'desc' },
      });
      const [totalSeats, activeWeek, neverActive] = await Promise.all([
        prisma.copilotSeat.count({ where: { orgSlug: org } }),
        prisma.copilotSeat.count({ where: { orgSlug: org, lastActivityAt: { gte: sevenDaysAgo } } }),
        prisma.copilotSeat.count({ where: { orgSlug: org, lastActivityAt: null } }),
      ]);
      return {
        org,
        totalSeats,
        activeThisCycle: snapshot?.activeThisCycle ?? 0,
        planType: snapshot?.planType ?? null,
        activeWeek,
        neverActive,
      };
    })
  );
  // Sort: known orgs first (alphabetical), _unknown last
  results.sort((a, b) => {
    if (a.org === '_unknown') return 1;
    if (b.org === '_unknown') return -1;
    return a.org.localeCompare(b.org);
  });
  return res.json(results);
});

// ── GET /api/copilot/ingestion-runs ────────────────────────────────────

router.get('/ingestion-runs', async (_req: Request, res: Response) => {
  const runs = await prisma.ingestionRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 20,
  });
  return res.json(runs);
});

// ── POST /api/copilot/ingest ────────────────────────────────────────────

router.post('/ingest', async (_req: Request, res: Response) => {
  logger.info('Manual ingestion triggered');
  const result = await runIngestion();
  return res.json(result);
});

export default router;

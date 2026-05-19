import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/client';
import { getGitHubClient, parseEditor, EnterpriseCopilotSeatRaw, UsageMetricsRow } from '../github/client';
import { config } from '../config';
import { logger } from '../lib/logger';

function toIsoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getCurrentMonthDays(): string[] {
  const today = new Date();
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const days: string[] = [];

  while (cursor <= end) {
    days.push(toIsoDay(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export interface IngestionResult {
  success: boolean;
  recordsProcessed: number;
  error?: string;
}

/** Run ingestion for a single org */
async function runIngestionForOrg(org: string): Promise<IngestionResult> {
  logger.info('Starting seat ingestion', { org });

  const runId = uuidv4();
  await prisma.ingestionRun.create({
    data: { id: runId, orgSlug: org, status: 'running', startedAt: new Date() },
  });

  try {
    const client = getGitHubClient();

    // Fetch and upsert billing snapshot
    const billing = await client.getBilling(org);
    await prisma.orgBillingSnapshot.create({
      data: {
        id: uuidv4(),
        orgSlug: org,
        totalSeats: billing.seat_breakdown.total,
        activeThisCycle: billing.seat_breakdown.active_this_cycle,
        inactiveThisCycle: billing.seat_breakdown.inactive_this_cycle,
        pendingCancellation: billing.seat_breakdown.pending_cancellation,
        pendingInvitation: billing.seat_breakdown.pending_invitation,
        addedThisCycle: billing.seat_breakdown.added_this_cycle,
        planType: billing.plan_type,
        seatManagement: billing.seat_management_setting,
      },
    });

    // Fetch all seats (paginated)
    const seats = await client.getAllSeats(org);

    // Upsert every seat
    for (const seat of seats) {
      const { editorName, editorVersion } = parseEditor(seat.last_activity_editor);
      await prisma.copilotSeat.upsert({
        where: { orgSlug_userLogin: { orgSlug: org, userLogin: seat.assignee.login } },
        update: {
          userId: seat.assignee.id,
          updatedAt: new Date(seat.updated_at),
          lastActivityAt: seat.last_activity_at ? new Date(seat.last_activity_at) : null,
          lastActivityEditor: seat.last_activity_editor,
          lastAuthenticatedAt: seat.last_authenticated_at ? new Date(seat.last_authenticated_at) : null,
          pendingCancellationDate: seat.pending_cancellation_date ? new Date(seat.pending_cancellation_date) : null,
          planType: seat.plan_type,
          editorName,
          editorVersion,
          syncedAt: new Date(),
        },
        create: {
          id: uuidv4(),
          orgSlug: org,
          userLogin: seat.assignee.login,
          userId: seat.assignee.id,
          createdAt: new Date(seat.created_at),
          updatedAt: new Date(seat.updated_at),
          lastActivityAt: seat.last_activity_at ? new Date(seat.last_activity_at) : null,
          lastActivityEditor: seat.last_activity_editor,
          lastAuthenticatedAt: seat.last_authenticated_at ? new Date(seat.last_authenticated_at) : null,
          pendingCancellationDate: seat.pending_cancellation_date ? new Date(seat.pending_cancellation_date) : null,
          planType: seat.plan_type,
          editorName,
          editorVersion,
        },
      });
    }

    await prisma.ingestionRun.update({
      where: { id: runId },
      data: { status: 'success', completedAt: new Date(), recordsProcessed: seats.length },
    });

    logger.info('Seat ingestion completed', { org, seats: seats.length });
    return { success: true, recordsProcessed: seats.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Seat ingestion failed', { org, error: message });
    await prisma.ingestionRun.update({
      where: { id: runId },
      data: { status: 'failed', completedAt: new Date(), errorMessage: message },
    });
    return { success: false, recordsProcessed: 0, error: message };
  }
}

/** Run ingestion for all configured orgs sequentially */
export async function runIngestion(): Promise<IngestionResult> {
  const enterpriseSlug = config.github.enterpriseSlug;

  // Prefer enterprise endpoint when a slug is configured — fetches ALL orgs in one call
  if (enterpriseSlug) {
    return runIngestionForEnterprise(enterpriseSlug);
  }

  // Fallback: per-org using GITHUB_ORGS
  const orgs = config.github.orgs;
  if (orgs.length === 0) {
    logger.warn('No orgs configured for ingestion');
    return { success: false, recordsProcessed: 0, error: 'No orgs configured' };
  }

  let totalRecords = 0;
  const errors: string[] = [];

  for (const org of orgs) {
    const result = await runIngestionForOrg(org);
    totalRecords += result.recordsProcessed;
    if (!result.success && result.error) errors.push(`${org}: ${result.error}`);
  }

  return {
    success: errors.length === 0,
    recordsProcessed: totalRecords,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

/** Fetch all 1,110 seats via enterprise endpoint, group by org, upsert everything */
async function runIngestionForEnterprise(enterprise: string): Promise<IngestionResult> {
  logger.info('Starting enterprise seat ingestion', { enterprise });
  const client = getGitHubClient();

  let allSeats: EnterpriseCopilotSeatRaw[];
  try {
    allSeats = await client.getEnterpriseAllSeats(enterprise);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Enterprise seat fetch failed', { enterprise, error: message });
    return { success: false, recordsProcessed: 0, error: message };
  }

  // Group seats by org
  const byOrg = new Map<string, EnterpriseCopilotSeatRaw[]>();
  for (const seat of allSeats) {
    const org = seat.organization?.login ?? '_unknown';
    if (!byOrg.has(org)) byOrg.set(org, []);
    byOrg.get(org)!.push(seat);
  }

  let totalRecords = 0;
  const errors: string[] = [];

  for (const [org, seats] of byOrg) {
    const runId = uuidv4();
    await prisma.ingestionRun.create({
      data: { id: runId, orgSlug: org, status: 'running', startedAt: new Date() },
    });

    try {
      // Try to get billing snapshot — silently skip if org is not directly accessible
      try {
        const billing = await client.getBilling(org);
        await prisma.orgBillingSnapshot.create({
          data: {
            id: uuidv4(),
            orgSlug: org,
            totalSeats: billing.seat_breakdown.total,
            activeThisCycle: billing.seat_breakdown.active_this_cycle,
            inactiveThisCycle: billing.seat_breakdown.inactive_this_cycle,
            pendingCancellation: billing.seat_breakdown.pending_cancellation,
            pendingInvitation: billing.seat_breakdown.pending_invitation,
            addedThisCycle: billing.seat_breakdown.added_this_cycle,
            planType: billing.plan_type,
            seatManagement: billing.seat_management_setting,
          },
        });
      } catch {
        logger.debug('Billing snapshot skipped (no direct org access)', { org });
      }

      // Upsert all seats for this org
      for (const seat of seats) {
        const { editorName, editorVersion } = parseEditor(seat.last_activity_editor);
        await prisma.copilotSeat.upsert({
          where: { orgSlug_userLogin: { orgSlug: org, userLogin: seat.assignee.login } },
          update: {
            userId: seat.assignee.id,
            updatedAt: new Date(seat.updated_at),
            lastActivityAt: seat.last_activity_at ? new Date(seat.last_activity_at) : null,
            lastActivityEditor: seat.last_activity_editor,
            lastAuthenticatedAt: seat.last_authenticated_at ? new Date(seat.last_authenticated_at) : null,
            pendingCancellationDate: seat.pending_cancellation_date ? new Date(seat.pending_cancellation_date) : null,
            planType: seat.plan_type,
            editorName,
            editorVersion,
            syncedAt: new Date(),
          },
          create: {
            id: uuidv4(),
            orgSlug: org,
            userLogin: seat.assignee.login,
            userId: seat.assignee.id,
            createdAt: new Date(seat.created_at),
            updatedAt: new Date(seat.updated_at),
            lastActivityAt: seat.last_activity_at ? new Date(seat.last_activity_at) : null,
            lastActivityEditor: seat.last_activity_editor,
            lastAuthenticatedAt: seat.last_authenticated_at ? new Date(seat.last_authenticated_at) : null,
            pendingCancellationDate: seat.pending_cancellation_date ? new Date(seat.pending_cancellation_date) : null,
            planType: seat.plan_type,
            editorName,
            editorVersion,
          },
        });
      }

      await prisma.ingestionRun.update({
        where: { id: runId },
        data: { status: 'success', completedAt: new Date(), recordsProcessed: seats.length },
      });

      logger.info('Org ingestion completed', { org, seats: seats.length });
      totalRecords += seats.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Org ingestion failed', { org, error: message });
      await prisma.ingestionRun.update({
        where: { id: runId },
        data: { status: 'failed', completedAt: new Date(), errorMessage: message },
      });
      errors.push(`${org}: ${message}`);
    }
  }

  logger.info('Enterprise ingestion completed', { enterprise, totalRecords, orgs: byOrg.size });
  return {
    success: errors.length === 0,
    recordsProcessed: totalRecords,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

// ── Usage Metrics Ingestion (GitHub Copilot metrics/reports API) ──────────

/** Download and upsert per-user NDJSON rows from a signed URL list. Returns totals. */
async function ingestUsageRows(downloadLinks: string[]): Promise<{
  totalRecords: number;
  usersFound: number;
  dateFrom: string;
  dateTo: string;
}> {
  const client = getGitHubClient();
  const BATCH_SIZE = 500;
  const batch: {
    id: string;
    userLogin: string;
    userId: number | null;
    day: Date;
    model: string;
    feature: string;
    interactions: number;
    codeGenCount: number;
    codeAcceptCount: number;
    locSuggestedAdd: number;
    locAdded: number;
  }[] = [];

  const users = new Set<string>();
  let minDay = '9999-99-99';
  let maxDay = '0000-00-00';
  let totalRecords = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    await prisma.userModelUsage.createMany({ data: [...batch], skipDuplicates: true });
    totalRecords += batch.length;
    batch.length = 0;
  };

  for (const url of downloadLinks) {
    const rows: UsageMetricsRow[] = await client.downloadUsageMetricsNdjson(url);
    for (const row of rows) {
      users.add(row.user_login);
      if (row.day < minDay) minDay = row.day;
      if (row.day > maxDay) maxDay = row.day;

      for (const item of row.totals_by_model_feature ?? []) {
        batch.push({
          id: `${row.user_login}_${row.day}_${item.model}_${item.feature}`,
          userLogin: row.user_login,
          userId: row.user_id ?? null,
          day: new Date(row.day),
          model: item.model,
          feature: item.feature,
          interactions: item.user_initiated_interaction_count ?? 0,
          codeGenCount: item.code_generation_activity_count ?? 0,
          codeAcceptCount: item.code_acceptance_activity_count ?? 0,
          locSuggestedAdd: item.loc_suggested_to_add_sum ?? 0,
          locAdded: item.loc_added_sum ?? 0,
        });
        if (batch.length >= BATCH_SIZE) await flush();
      }
    }
  }

  await flush();
  return {
    totalRecords,
    usersFound: users.size,
    dateFrom: minDay === '9999-99-99' ? '' : minDay,
    dateTo: maxDay,
  };
}

/** Sync model pricing from premium_request/usage billing API. Non-fatal on failure. */
async function syncModelPricing(enterprise: string): Promise<void> {
  try {
    const client = getGitHubClient();
    const { usageItems } = await client.getPremiumRequestUsage(enterprise);
    for (const item of usageItems) {
      if (!item.model) continue;
      await prisma.modelPricing.upsert({
        where: { model: item.model },
        update: { sku: item.sku, pricePerUnit: item.pricePerUnit, unitType: item.unitType },
        create: { model: item.model, sku: item.sku, pricePerUnit: item.pricePerUnit, unitType: item.unitType },
      });
    }
    logger.debug('Model pricing synced', { enterprise, count: usageItems.length });
  } catch (err) {
    logger.warn('Model pricing sync failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Full current-month usage metrics sync.
 * Use for initial load or on-demand refresh — fetches one report per day from the
 * first day of the current month through today.
 */
export async function runUsageMetricsIngestion(enterprise: string): Promise<IngestionResult> {
  const days = getCurrentMonthDays();
  logger.info('Starting usage metrics ingestion (current month)', {
    enterprise,
    dayCount: days.length,
    dateFrom: days[0],
    dateTo: days[days.length - 1],
  });

  try {
    await syncModelPricing(enterprise);

    const client = getGitHubClient();
    const downloadLinks: string[] = [];

    for (const day of days) {
      const report = await client.getMetricsReportUsers1Day(enterprise, day);
      downloadLinks.push(...report.download_links);
    }

    const { totalRecords, usersFound, dateFrom, dateTo } = await ingestUsageRows(downloadLinks);

    if (totalRecords > 0) {
      await prisma.usageImportRun.create({
        data: {
          id: uuidv4(),
          recordsLoaded: totalRecords,
          usersFound,
          dateFrom,
          dateTo,
          sourceType: 'api-current-month',
        },
      });
    }

    logger.info('Usage metrics ingestion completed', { enterprise, totalRecords, usersFound, dateFrom, dateTo });
    return { success: true, recordsProcessed: totalRecords };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Usage metrics ingestion failed', { enterprise, error: message });
    return { success: false, recordsProcessed: 0, error: message };
  }
}

/**
 * Daily delta sync — fetches only the previous day's report.
 * Called by the scheduled cron after the initial load.
 */
export async function runDailyUsageIngestion(enterprise: string): Promise<IngestionResult> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const day = yesterday.toISOString().slice(0, 10);

  logger.info('Starting daily usage metrics ingestion', { enterprise, day });
  try {
    await syncModelPricing(enterprise);

    const client = getGitHubClient();
    const report = await client.getMetricsReportUsers1Day(enterprise, day);
    const { totalRecords, usersFound, dateFrom, dateTo } = await ingestUsageRows(report.download_links);

    if (totalRecords > 0) {
      await prisma.usageImportRun.create({
        data: {
          id: uuidv4(),
          recordsLoaded: totalRecords,
          usersFound,
          dateFrom,
          dateTo,
          sourceType: 'api-1d',
        },
      });
    }

    logger.info('Daily usage ingestion completed', { enterprise, day, totalRecords, usersFound });
    return { success: true, recordsProcessed: totalRecords };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Daily usage ingestion failed', { enterprise, day, error: message });
    return { success: false, recordsProcessed: 0, error: message };
  }
}

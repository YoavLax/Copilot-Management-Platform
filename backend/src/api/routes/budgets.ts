import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import {
  getGitHubClient,
  type EnterpriseBudgetListResponse,
  type EnterpriseBudgetRaw,
} from '../../github/client';

const router = Router();

const listBudgetsQuerySchema = z.object({
  user: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  budgetTarget: z.string().trim().min(1).optional().default('premium_requests'),
});

const updateBudgetBodySchema = z.object({
  budgetAmount: z.coerce.number().positive(),
});

const createBudgetBodySchema = z.object({
  user: z.string().trim().min(1),
  budgetAmount: z.coerce.number().positive(),
  budgetTarget: z.string().trim().min(1).optional().default('premium_requests'),
  preventFurtherUsage: z.boolean().optional().default(true),
});

const upsertBudgetBodySchema = z.object({
  user: z.string().trim().min(1),
  budgetAmount: z.coerce.number().positive(),
  budgetTarget: z.string().trim().min(1).optional().default('premium_requests'),
  preventFurtherUsage: z.boolean().optional().default(true),
});

const teamUpdateBodySchema = z.object({
  org: z.string().trim().min(1),
  teamSlug: z.string().trim().min(1),
  budgetAmount: z.coerce.number().positive(),
  budgetTarget: z.string().trim().min(1).optional().default('premium_requests'),
  createIfMissing: z.boolean().optional().default(true),
  preventFurtherUsage: z.boolean().optional().default(true),
});

function getEnterpriseSlug(): string {
  if (!config.github.enterpriseSlug) {
    throw new Error('Missing GITHUB_ENTERPRISE_SLUG configuration');
  }
  return config.github.enterpriseSlug;
}

function extractBudgetItems(payload: EnterpriseBudgetRaw[] | EnterpriseBudgetListResponse): EnterpriseBudgetRaw[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.budgets)) return payload.budgets;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

function normalizeBudget(raw: EnterpriseBudgetRaw) {
  const effectiveBudget =
    raw.effective_budget && typeof raw.effective_budget === 'object' ? raw.effective_budget : null;
  const resolved = effectiveBudget ?? raw;

  const currentValue =
    typeof raw.current_amount === 'number'
      ? raw.current_amount
      : typeof raw.current_usage === 'number'
        ? raw.current_usage
        : null;

  return {
    id: String(resolved.id ?? raw.id),
    user: (raw.user ?? resolved.user ?? null) as string | null,
    budgetAmount: Number(resolved.budget_amount ?? raw.budget_amount ?? 0),
    budgetScope: (resolved.budget_scope ?? raw.budget_scope ?? null) as string | null,
    budgetProductSku: (resolved.budget_product_sku ?? raw.budget_product_sku ?? null) as string | null,
    budgetType: (resolved.budget_type ?? raw.budget_type ?? null) as string | null,
    preventFurtherUsage: Boolean(resolved.prevent_further_usage ?? raw.prevent_further_usage ?? false),
    alertsEnabled: Boolean(
      (resolved.budget_alerting as { will_alert?: boolean } | undefined)?.will_alert ??
        (raw.budget_alerting as { will_alert?: boolean } | undefined)?.will_alert ??
        false
    ),
    currentAmount: currentValue,
    createdAt: (resolved.created_at ?? raw.created_at ?? null) as string | null,
    updatedAt: (resolved.updated_at ?? raw.updated_at ?? null) as string | null,
    hasEffectiveBudget: Boolean(effectiveBudget),
    raw,
  };
}

function findExistingPersonalBudget(
  budgets: EnterpriseBudgetRaw[],
  userLogin: string,
  budgetTarget?: string
): EnterpriseBudgetRaw | null {
  const normalizedUser = userLogin.toLowerCase();
  return (
    budgets.find((budget) => {
      const budgetUser = typeof budget.user === 'string' ? budget.user.toLowerCase() : null;
      if (budgetUser !== normalizedUser) return false;
      if (budgetTarget) {
        const target = budget.effective_budget?.budget_product_sku ?? budget.budget_product_sku;
        return target === budgetTarget;
      }
      return true;
    }) ?? null
  );
}

function findDefaultPerUserBudget(
  budgets: EnterpriseBudgetRaw[],
  budgetTarget?: string
): EnterpriseBudgetRaw | null {
  return (
    budgets.find((budget) => {
      const scope = budget.effective_budget?.budget_scope ?? budget.budget_scope;
      if (scope !== 'multi_user_customer') return false;
      if (budgetTarget) {
        const target = budget.effective_budget?.budget_product_sku ?? budget.budget_product_sku;
        return target === budgetTarget;
      }
      return true;
    }) ?? null
  );
}

function formatInheritedBudgetMessage(defaultBudget: EnterpriseBudgetRaw | null): string {
  if (!defaultBudget) {
    return 'No existing personal budget override was found for this user.';
  }

  const amount = Number(defaultBudget.effective_budget?.budget_amount ?? defaultBudget.budget_amount ?? 0);
  const formattedAmount = Number.isFinite(amount)
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    : 'the universal per-user budget';

  return `This user inherits the universal per-user budget (${formattedAmount}). GitHub exposes PATCH for existing budget IDs, but this enterprise currently rejects creating new user-specific overrides via POST.`;
}

function mapBudgetMutationError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';

  if (
    message.includes("Invalid budget_scope 'user'") ||
    message.includes("Invalid budget scope 'user'")
  ) {
    return 'GitHub rejected personal budget creation for this enterprise. Existing personal overrides can still be updated, but creating new per-user overrides is not supported by the current budget API in this environment.';
  }

  return message;
}

function isUnsupportedUserBudgetCreationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return (
    message.includes("Invalid budget_scope 'user'") ||
    message.includes("Invalid budget scope 'user'")
  );
}

async function createOrUpdatePersonalBudget(params: {
  user: string;
  budgetAmount: number;
  budgetTarget: string;
  preventFurtherUsage: boolean;
}) {
  const enterprise = getEnterpriseSlug();
  const github = getGitHubClient();
  const payload = await github.listEnterpriseBudgets(enterprise, {
    budgetTarget: params.budgetTarget,
  });
  const existingBudget = findExistingPersonalBudget(
    extractBudgetItems(payload),
    params.user,
    params.budgetTarget
  );

  if (existingBudget) {
    const updated = await github.updateEnterpriseBudget(enterprise, existingBudget.id, {
      budgetAmount: params.budgetAmount,
    });
    return {
      action: 'updated' as const,
      item: normalizeBudget(updated),
      budgetId: existingBudget.id,
    };
  }

  const created = await github.createEnterpriseBudget(enterprise, {
    user: params.user,
    budgetAmount: params.budgetAmount,
    budgetProductSku: params.budgetTarget,
    preventFurtherUsage: params.preventFurtherUsage,
  });
  return {
    action: 'created' as const,
    item: normalizeBudget(created),
    budgetId: created.id,
  };
}

router.get('/budgets', async (req: Request, res: Response) => {
  const parsed = listBudgetsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
  }

  const enterprise = getEnterpriseSlug();
  const github = getGitHubClient();
  const payload = await github.listEnterpriseBudgets(enterprise, {
    budgetTarget: parsed.data.budgetTarget,
  });
  let budgets = extractBudgetItems(payload).map(normalizeBudget);

  if (parsed.data.search) {
    const query = parsed.data.search.toLowerCase();
    budgets = budgets.filter((budget) => budget.user?.toLowerCase().includes(query));
  }

  return res.json({
    total: budgets.length,
    items: budgets,
  });
});

router.patch('/budgets/:budgetId', async (req: Request, res: Response) => {
  const body = updateBudgetBodySchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid request body', details: body.error.flatten() });
  }

  const budgetId = req.params.budgetId?.trim();
  if (!budgetId) {
    return res.status(400).json({ error: 'budgetId is required' });
  }

  const enterprise = getEnterpriseSlug();
  const github = getGitHubClient();
  const updated = await github.updateEnterpriseBudget(enterprise, budgetId, {
    budgetAmount: body.data.budgetAmount,
  });

  return res.json({ item: normalizeBudget(updated) });
});

router.post('/budgets', async (req: Request, res: Response) => {
  const body = createBudgetBodySchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid request body', details: body.error.flatten() });
  }

  try {
    const enterprise = getEnterpriseSlug();
    const github = getGitHubClient();
    const created = await github.createEnterpriseBudget(enterprise, {
      user: body.data.user,
      budgetAmount: body.data.budgetAmount,
      budgetProductSku: body.data.budgetTarget,
      preventFurtherUsage: body.data.preventFurtherUsage,
    });

    return res.status(201).json({ item: normalizeBudget(created) });
  } catch (error) {
    return res.status(400).json({ error: mapBudgetMutationError(error) });
  }
});

router.post('/budgets/upsert', async (req: Request, res: Response) => {
  const body = upsertBudgetBodySchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid request body', details: body.error.flatten() });
  }

  try {
    const result = await createOrUpdatePersonalBudget({
      user: body.data.user,
      budgetAmount: body.data.budgetAmount,
      budgetTarget: body.data.budgetTarget,
      preventFurtherUsage: body.data.preventFurtherUsage,
    });

    return res.json({ action: result.action, item: result.item });
  } catch (error) {
    return res.status(400).json({ error: mapBudgetMutationError(error) });
  }
});

router.get('/orgs/:org/teams', async (req: Request, res: Response) => {
  const org = req.params.org?.trim();
  if (!org) {
    return res.status(400).json({ error: 'org is required' });
  }

  const github = getGitHubClient();
  const teams = await github.listOrgTeams(org);
  const items = teams
    .map((team) => ({
      id: team.id,
      slug: team.slug,
      name: team.name,
      description: team.description ?? null,
      privacy: typeof team.privacy === 'string' ? team.privacy : null,
      membersCount: typeof team.members_count === 'number' ? team.members_count : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return res.json({ total: items.length, items });
});

router.get('/orgs/:org/teams/:teamSlug/members', async (req: Request, res: Response) => {
  const org = req.params.org?.trim();
  const teamSlug = req.params.teamSlug?.trim();
  if (!org || !teamSlug) {
    return res.status(400).json({ error: 'org and teamSlug are required' });
  }

  const github = getGitHubClient();
  const members = await github.listTeamMembers(org, teamSlug);
  const items = members
    .map((member) => ({
      login: member.login,
      id: member.id,
      avatarUrl: typeof member.avatar_url === 'string' ? member.avatar_url : null,
      htmlUrl: typeof member.html_url === 'string' ? member.html_url : null,
    }))
    .sort((a, b) => a.login.localeCompare(b.login));

  return res.json({ total: items.length, items });
});

router.post('/budgets/team-update', async (req: Request, res: Response) => {
  const body = teamUpdateBodySchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid request body', details: body.error.flatten() });
  }

  const { org, teamSlug, budgetAmount, budgetTarget, createIfMissing, preventFurtherUsage } = body.data;
  const github = getGitHubClient();

  const members = await github.listTeamMembers(org, teamSlug);
  const memberResults = await Promise.all(
    members.map(async (member) => {
      try {
        const enterprise = getEnterpriseSlug();
        const payload = await github.listEnterpriseBudgets(enterprise, {
          budgetTarget,
        });
        const budgetItems = extractBudgetItems(payload);
        const matchingBudget = findExistingPersonalBudget(budgetItems, member.login, budgetTarget);
        const defaultPerUserBudget = findDefaultPerUserBudget(budgetItems, budgetTarget);

        if (!matchingBudget && !createIfMissing) {
          return {
            user: member.login,
            status: 'skipped_no_existing_budget' as const,
            budgetId: null,
            message: formatInheritedBudgetMessage(defaultPerUserBudget),
          };
        }

        let result;
        try {
          result = await createOrUpdatePersonalBudget({
            user: member.login,
            budgetAmount,
            budgetTarget,
            preventFurtherUsage,
          });
        } catch (error) {
          if (!matchingBudget && isUnsupportedUserBudgetCreationError(error)) {
            return {
              user: member.login,
              status: 'skipped_no_existing_budget' as const,
              budgetId: null,
              message: formatInheritedBudgetMessage(defaultPerUserBudget),
            };
          }

          throw error;
        }

        return {
          user: member.login,
          status: result.action === 'created' ? ('created' as const) : ('updated' as const),
          budgetId: result.budgetId,
          item: result.item,
          message: result.action === 'created' ? 'Created a new personal override' : 'Updated existing personal override',
        };
      } catch (error) {
        const message = mapBudgetMutationError(error);
        return {
          user: member.login,
          status: 'failed' as const,
          budgetId: null,
          message,
        };
      }
    })
  );

  const summary = memberResults.reduce(
    (acc, item) => {
      if (item.status === 'updated') acc.updated += 1;
      else if (item.status === 'created') acc.created += 1;
      else if (item.status === 'skipped_no_existing_budget') acc.skipped += 1;
      else if (item.status === 'failed') acc.failed += 1;
      return acc;
    },
    { updated: 0, created: 0, skipped: 0, failed: 0 }
  );

  return res.json({
    org,
    teamSlug,
    budgetAmount,
    budgetTarget,
    createIfMissing,
    totalMembers: members.length,
    summary,
    results: memberResults,
  });
});

export default router;
import { config } from '../config';
import { logger } from '../lib/logger';

export interface UsageMetricsRow {
  user_id: number;
  user_login: string;
  day: string;
  enterprise_id: string;
  totals_by_model_feature: {
    model: string;
    feature: string;
    user_initiated_interaction_count: number;
    code_generation_activity_count: number;
    code_acceptance_activity_count: number;
    loc_suggested_to_add_sum: number;
    loc_added_sum: number;
  }[];
}

export interface PremiumRequestUsageItem {
  product: string;
  sku: string;
  model: string;
  unitType: string;
  pricePerUnit: number;
  grossQuantity: number;
  grossAmount: number;
  discountQuantity: number;
  discountAmount: number;
  netQuantity: number;
  netAmount: number;
}

export interface MetricsReportResponse {
  download_links: string[];
  report_day?: string;
  report_start_day?: string;
  report_end_day?: string;
}

export interface CopilotSeatRaw {
  created_at: string;
  updated_at: string;
  last_activity_at: string | null;
  last_activity_editor: string | null;
  last_authenticated_at: string | null;
  pending_cancellation_date: string | null;
  plan_type: string | null;
  assignee: {
    login: string;
    id: number;
  };
}

export interface EnterpriseCopilotSeatRaw extends CopilotSeatRaw {
  organization: {
    login: string;
    id: number;
  } | null;
}

export interface CopilotBillingRaw {
  seat_breakdown: {
    total: number;
    active_this_cycle: number;
    inactive_this_cycle: number;
    pending_cancellation: number;
    pending_invitation: number;
    added_this_cycle: number;
  };
  plan_type: string | null;
  seat_management_setting: string | null;
}

export interface SeatsPage {
  total_seats: number;
  seats: CopilotSeatRaw[];
}

export interface EnterpriseSeatsPage {
  total_seats: number;
  seats: EnterpriseCopilotSeatRaw[];
}

export interface EnterpriseBudgetRaw {
  id: string;
  budget_amount: number;
  budget_scope: string;
  user?: string | null;
  prevent_further_usage?: boolean;
  budget_product_sku?: string | null;
  budget_type?: string | null;
  created_at?: string;
  updated_at?: string;
  consumed_amount?: number;
  current_amount?: number;
  current_usage?: number;
  effective_budget?: EnterpriseBudgetRaw | null;
  [key: string]: unknown;
}

export interface EnterpriseBudgetListResponse {
  budgets?: EnterpriseBudgetRaw[];
  items?: EnterpriseBudgetRaw[];
  [key: string]: unknown;
}

export interface OrgTeamRaw {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  privacy?: string;
  members_count?: number;
  [key: string]: unknown;
}

export interface TeamMemberRaw {
  login: string;
  id: number;
  avatar_url?: string;
  html_url?: string;
  [key: string]: unknown;
}

export interface UpdateEnterpriseBudgetInput {
  budgetAmount: number;
}

export interface CreateEnterpriseBudgetInput {
  user: string;
  budgetAmount: number;
  budgetProductSku: string;
  budgetType?: string;
  preventFurtherUsage?: boolean;
}

function buildBudgetAlertRecipients(user: string): string[] {
  const normalizedUser = user.trim();
  return normalizedUser ? [normalizedUser] : [];
}

class GitHubCopilotClient {
  private token: string;
  private baseUrl = 'https://api.github.com';
  private headers: Record<string, string>;

  constructor(token: string) {
    this.token = token;
    this.headers = {
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      Accept: 'application/vnd.github+json',
    };
  }

  async getBilling(org: string): Promise<CopilotBillingRaw> {
    logger.debug('Fetching Copilot billing', { org });
    const r = await fetch(`${this.baseUrl}/orgs/${org}/copilot/billing`, {
      headers: this.headers,
    });
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`GET /orgs/${org}/copilot/billing → ${r.status}: ${body}`);
    }
    return r.json() as Promise<CopilotBillingRaw>;
  }

  async getAllSeats(org: string): Promise<CopilotSeatRaw[]> {
    logger.debug('Fetching all Copilot seats', { org });
    const allSeats: CopilotSeatRaw[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const r = await fetch(
        `${this.baseUrl}/orgs/${org}/copilot/billing/seats?per_page=${perPage}&page=${page}`,
        { headers: this.headers }
      );
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`GET /orgs/${org}/copilot/billing/seats → ${r.status}: ${body}`);
      }
      const data = (await r.json()) as SeatsPage;
      allSeats.push(...data.seats);

      if (data.seats.length < perPage) break;
      page++;
    }

    logger.info('Fetched all seats', { org, count: allSeats.length });
    return allSeats;
  }

  async getEnterpriseAllSeats(enterprise: string): Promise<EnterpriseCopilotSeatRaw[]> {
    logger.debug('Fetching all enterprise Copilot seats', { enterprise });
    const allSeats: EnterpriseCopilotSeatRaw[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const r = await fetch(
        `${this.baseUrl}/enterprises/${enterprise}/copilot/billing/seats?per_page=${perPage}&page=${page}`,
        { headers: this.headers }
      );
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`GET /enterprises/${enterprise}/copilot/billing/seats → ${r.status}: ${body}`);
      }
      const data = (await r.json()) as EnterpriseSeatsPage;
      allSeats.push(...data.seats);

      // Stop only when we receive a partial page — total_seats reflects unique users
      // but the API may return more records (same user in multiple orgs), so we must
      // not stop early based on count alone.
      if (data.seats.length < perPage) break;
      page++;
    }

    logger.info('Fetched all enterprise seats', { enterprise, count: allSeats.length });
    return allSeats;
  }

  async getMetricsReportUsers1Day(enterprise: string, day: string): Promise<MetricsReportResponse> {
    logger.debug('Fetching 1-day per-user metrics report', { enterprise, day });
    const r = await fetch(
      `${this.baseUrl}/enterprises/${enterprise}/copilot/metrics/reports/users-1-day?day=${day}`,
      { headers: this.headers }
    );
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`GET /enterprises/${enterprise}/copilot/metrics/reports/users-1-day → ${r.status}: ${body}`);
    }
    return r.json() as Promise<MetricsReportResponse>;
  }

  async getMetricsReportUsers28DayLatest(enterprise: string): Promise<MetricsReportResponse> {
    logger.debug('Fetching 28-day per-user metrics report', { enterprise });
    const r = await fetch(
      `${this.baseUrl}/enterprises/${enterprise}/copilot/metrics/reports/users-28-day/latest`,
      { headers: this.headers }
    );
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`GET /enterprises/${enterprise}/copilot/metrics/reports/users-28-day/latest → ${r.status}: ${body}`);
    }
    return r.json() as Promise<MetricsReportResponse>;
  }

  async downloadUsageMetricsNdjson(url: string): Promise<UsageMetricsRow[]> {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Failed to download usage metrics report: ${r.status}`);
    const text = await r.text();
    const rows: UsageMetricsRow[] = [];
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line) as UsageMetricsRow);
      } catch {
        // skip malformed lines
      }
    }
    return rows;
  }

  async getPremiumRequestUsage(enterprise: string): Promise<{ usageItems: PremiumRequestUsageItem[] }> {
    logger.debug('Fetching premium request usage', { enterprise });
    const r = await fetch(
      `${this.baseUrl}/enterprises/${enterprise}/settings/billing/premium_request/usage`,
      { headers: this.headers }
    );
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`GET /enterprises/${enterprise}/settings/billing/premium_request/usage → ${r.status}: ${body}`);
    }
    return r.json() as Promise<{ usageItems: PremiumRequestUsageItem[] }>;
  }

  async listEnterpriseBudgets(
    enterprise: string,
    filters?: { user?: string; budgetTarget?: string }
  ): Promise<EnterpriseBudgetRaw[] | EnterpriseBudgetListResponse> {
    logger.debug('Fetching enterprise budgets', { enterprise, filters });
    const query = new URLSearchParams();
    if (filters?.budgetTarget) query.set('budgetTarget', filters.budgetTarget);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const r = await fetch(
      `${this.baseUrl}/enterprises/${enterprise}/settings/billing/budgets${suffix}`,
      { headers: this.headers }
    );
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`GET /enterprises/${enterprise}/settings/billing/budgets → ${r.status}: ${body}`);
    }
    return r.json() as Promise<EnterpriseBudgetRaw[] | EnterpriseBudgetListResponse>;
  }

  async updateEnterpriseBudget(
    enterprise: string,
    budgetId: string,
    input: UpdateEnterpriseBudgetInput
  ): Promise<EnterpriseBudgetRaw> {
    logger.debug('Updating enterprise budget', { enterprise, budgetId, budgetAmount: input.budgetAmount });
    const r = await fetch(
      `${this.baseUrl}/enterprises/${enterprise}/settings/billing/budgets/${budgetId}`,
      {
        method: 'PATCH',
        headers: {
          ...this.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ budget_amount: input.budgetAmount }),
      }
    );
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`PATCH /enterprises/${enterprise}/settings/billing/budgets/${budgetId} → ${r.status}: ${body}`);
    }
    return r.json() as Promise<EnterpriseBudgetRaw>;
  }

  async createEnterpriseBudget(
    enterprise: string,
    input: CreateEnterpriseBudgetInput
  ): Promise<EnterpriseBudgetRaw> {
    logger.debug('Creating enterprise budget override', {
      enterprise,
      user: input.user,
      budgetAmount: input.budgetAmount,
      budgetProductSku: input.budgetProductSku,
    });

    const r = await fetch(
      `${this.baseUrl}/enterprises/${enterprise}/settings/billing/budgets`,
      {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          budget_amount: input.budgetAmount,
          budget_scope: 'user',
          user: input.user,
          prevent_further_usage: input.preventFurtherUsage ?? true,
          budget_product_sku: input.budgetProductSku,
          budget_type: input.budgetType ?? 'BundlePricing',
          budget_alerting: {
            will_alert: true,
            alert_recipients: buildBudgetAlertRecipients(input.user),
          },
        }),
      }
    );
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`POST /enterprises/${enterprise}/settings/billing/budgets → ${r.status}: ${body}`);
    }
    return r.json() as Promise<EnterpriseBudgetRaw>;
  }

  async listOrgTeams(org: string): Promise<OrgTeamRaw[]> {
    logger.debug('Fetching org teams', { org });
    const teams: OrgTeamRaw[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const r = await fetch(
        `${this.baseUrl}/orgs/${org}/teams?per_page=${perPage}&page=${page}`,
        { headers: this.headers }
      );
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`GET /orgs/${org}/teams → ${r.status}: ${body}`);
      }

      const data = (await r.json()) as OrgTeamRaw[];
      teams.push(...data);
      if (data.length < perPage) break;
      page++;
    }

    return teams;
  }

  async listTeamMembers(org: string, teamSlug: string): Promise<TeamMemberRaw[]> {
    logger.debug('Fetching team members', { org, teamSlug });
    const members: TeamMemberRaw[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const r = await fetch(
        `${this.baseUrl}/orgs/${org}/teams/${teamSlug}/members?per_page=${perPage}&page=${page}`,
        { headers: this.headers }
      );
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`GET /orgs/${org}/teams/${teamSlug}/members → ${r.status}: ${body}`);
      }

      const data = (await r.json()) as TeamMemberRaw[];
      members.push(...data);
      if (data.length < perPage) break;
      page++;
    }

    return members;
  }
}

let _client: GitHubCopilotClient | null = null;

export function getGitHubClient(): GitHubCopilotClient {
  if (!_client) {
    _client = new GitHubCopilotClient(config.github.token);
  }
  return _client;
}

/** Parse "vscode/1.118.1/copilot-chat/0.46.2" → { name: 'vscode', version: '1.118.1' } */
export function parseEditor(raw: string | null): { editorName: string | null; editorVersion: string | null } {
  if (!raw) return { editorName: null, editorVersion: null };
  const parts = raw.split('/');
  const name = parts[0]?.toLowerCase() ?? null;
  const version = parts[1] ?? null;
  return { editorName: name, editorVersion: version };
}

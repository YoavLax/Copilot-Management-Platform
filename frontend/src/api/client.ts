import type { SummaryResponse, SeatsResponse, SeatsFilters, IngestionRun, OrgSummary, ModelUsageSummary, UserModelUsageResponse, ModelUsageFilters } from '../types';

const BASE = '/api/copilot';

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== 'all') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getSummary: (org?: string) => apiFetch<SummaryResponse>(`${BASE}/summary${org && org !== 'all' ? `?org=${encodeURIComponent(org)}` : ''}`),

  getSeats: (filters: SeatsFilters) =>
    apiFetch<SeatsResponse>(
      `${BASE}/seats${buildQuery({
        search: filters.search,
        editor: filters.editor,
        org: filters.org,
        status: filters.status,
        sort: filters.sort,
        page: filters.page,
        pageSize: filters.pageSize,
      })}`
    ),

  getEditors: () => apiFetch<string[]>(`${BASE}/editors`),

  getOrgs: () => apiFetch<OrgSummary[]>(`${BASE}/orgs`),

  getIngestionRuns: () => apiFetch<IngestionRun[]>(`${BASE}/ingestion-runs`),

  triggerIngestion: () =>
    fetch(`${BASE}/ingest`, { method: 'POST' }).then((r) => r.json()),

  // Model Usage
  getModelUsageSummary: () => apiFetch<ModelUsageSummary>(`${BASE}/model-usage/summary`),

  getModelUsageUsers: (filters: ModelUsageFilters) =>
    apiFetch<UserModelUsageResponse>(
      `${BASE}/model-usage/users${buildQuery({
        search: filters.search,
        primaryModel: filters.primaryModel,
        sort: filters.sort,
        page: filters.page,
        pageSize: filters.pageSize,
      })}`
    ),

  getModelUsageModels: () => apiFetch<string[]>(`${BASE}/model-usage/models`),

  syncModelUsage: () =>
    fetch(`${BASE}/model-usage/import`, { method: 'POST' }).then((r) => r.json()),
};

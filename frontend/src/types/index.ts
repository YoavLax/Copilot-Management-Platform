export interface OrgBillingSnapshot {
  id: string;
  orgSlug: string;
  snapshotAt: string;
  totalSeats: number;
  activeThisCycle: number;
  inactiveThisCycle: number;
  pendingCancellation: number;
  pendingInvitation: number;
  addedThisCycle: number;
  planType: string | null;
  seatManagement: string | null;
}

export interface ActivityBreakdown {
  activeToday: number;
  activeWeek: number;
  activeMonth: number;
  neverActive: number;
}

export interface EditorCount {
  editor: string;
  seats: number;
}

export interface FeatureCount {
  feature: string;
  seats: number;
}

export interface SummaryResponse {
  snapshot: OrgBillingSnapshot | null;
  lastSyncAt: string | null;
  activity: ActivityBreakdown;
  editors: EditorCount[];
  features: FeatureCount[];
}

export interface OrgSummary {
  org: string;
  totalSeats: number;
  activeThisCycle: number;
  planType: string | null;
  activeWeek: number;
  neverActive: number;
}

export type ActivityStatus = 'active' | 'recent' | 'dormant' | 'never';

export interface SeatRow {
  userLogin: string;
  userId: number | null;
  orgSlug: string;
  lastActivityAt: string | null;
  lastActivityEditor: string | null;
  lastAuthenticatedAt: string | null;
  pendingCancellationDate: string | null;
  planType: string | null;
  editorName: string | null;
  editorVersion: string | null;
  seatCreatedAt: string;
  syncedAt: string;
  activityStatus: ActivityStatus;
  daysSinceActive: number | null;
  feature: string;
  isSeated: boolean;
}

export interface SeatsResponse {
  page: number;
  pageSize: number;
  total: number;
  items: SeatRow[];
}

export interface IngestionRun {
  id: string;
  orgSlug: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  recordsProcessed: number;
}

export interface SeatsFilters {
  search?: string;
  editor?: string;
  org?: string;
  status?: ActivityStatus | 'all';
  sort?: 'lastActivityAt_desc' | 'lastActivityAt_asc' | 'userLogin_asc' | 'seatCreatedAt_desc';
  page?: number;
  pageSize?: number;
}

// ── Model Usage types ───────────────────────────────────────────────────

export interface ModelStat {
  model: string;
  interactions: number;
  codeGenCount: number;
  locSuggestedAdd: number;
  locAdded: number;
  users: number;
}

export interface ModelUsageSummary {
  totalInteractions: number;
  locSuggestedAdd: number;
  locAdded: number;
  uniqueUsers: number;
  uniqueModels: number;
  dateFrom: string | null;
  dateTo: string | null;
  lastImport: { importedAt: string; recordsLoaded: number } | null;
  topModels: ModelStat[];
}

export interface UserModelStat {
  userLogin: string;
  userId: number | null;
  totalInteractions: number;
  codeGenCount: number;
  codeAcceptCount: number;
  locSuggestedAdd: number;
  locAdded: number;
  chatInteractions: number;
  agentInteractions: number;
  acceptanceRate: number;
  primaryModel: string | null;
  models: { model: string; interactions: number }[];
}

export interface UserModelUsageResponse {
  total: number;
  page: number;
  pageSize: number;
  users: UserModelStat[];
}

export interface ModelUsageFilters {
  search?: string;
  primaryModel?: string;
  sort?: 'interactions_desc' | 'locAdded_desc' | 'locSuggested_desc' | 'acceptance_desc' | 'user_asc';
  page?: number;
  pageSize?: number;
}

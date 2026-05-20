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

export interface AppConfigResponse {
  enterpriseSlug: string | null;
  demoMode: boolean;
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

// ── Budget administration types ───────────────────────────────────────

export interface BudgetItem {
  id: string;
  user: string | null;
  budgetAmount: number;
  budgetScope: string | null;
  budgetProductSku: string | null;
  budgetType: string | null;
  preventFurtherUsage: boolean;
  alertsEnabled: boolean;
  currentAmount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  hasEffectiveBudget: boolean;
}

export interface BudgetListResponse {
  total: number;
  items: BudgetItem[];
}

export interface BudgetFilters {
  search?: string;
  user?: string;
  budgetTarget?: string;
}

export interface TeamSummary {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  privacy: string | null;
  membersCount: number | null;
}

export interface TeamListResponse {
  total: number;
  items: TeamSummary[];
}

export interface TeamMember {
  login: string;
  id: number;
  avatarUrl: string | null;
  htmlUrl: string | null;
}

export interface TeamMemberListResponse {
  total: number;
  items: TeamMember[];
}

export interface UpdateBudgetRequest {
  budgetId: string;
  budgetAmount: number;
}

export interface UpdateBudgetResponse {
  item: BudgetItem;
}

export interface UpsertBudgetRequest {
  user: string;
  budgetAmount: number;
  budgetTarget?: string;
  preventFurtherUsage?: boolean;
}

export interface UpsertBudgetResponse {
  action: 'created' | 'updated';
  item: BudgetItem;
}

export interface TeamBudgetUpdateRequest {
  org: string;
  teamSlug: string;
  budgetAmount: number;
  budgetTarget?: string;
  createIfMissing?: boolean;
  preventFurtherUsage?: boolean;
}

export type TeamBudgetUpdateStatus = 'created' | 'updated' | 'skipped_no_existing_budget' | 'failed';

export interface TeamBudgetUpdateResult {
  user: string;
  status: TeamBudgetUpdateStatus;
  budgetId: string | null;
  item?: BudgetItem;
  message?: string;
}

export interface TeamBudgetUpdateResponse {
  org: string;
  teamSlug: string;
  budgetAmount: number;
  budgetTarget: string;
  totalMembers: number;
  summary: {
    updated: number;
    created: number;
    skipped: number;
    failed: number;
  };
  results: TeamBudgetUpdateResult[];
}

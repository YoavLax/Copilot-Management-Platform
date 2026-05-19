import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Search, X, Download } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AppLayout } from '../components/layout/AppLayout';
import { useSeats, useEditors, useModelUsageUsers } from '../hooks/useUsage';
import type { SeatsFilters, SeatRow, ActivityStatus, UserModelStat } from '../types';
import { modelColor, isOpusModel } from '../utils/modelColors';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active (7d)' },
  { value: 'recent', label: 'Recent (30d)' },
  { value: 'dormant', label: 'Dormant (>30d)' },
  { value: 'never', label: 'Never active' },
];

const SORT_OPTIONS = [
  { value: 'lastActivityAt_desc', label: 'Last active (newest)' },
  { value: 'lastActivityAt_asc', label: 'Last active (oldest)' },
  { value: 'userLogin_asc', label: 'Username A→Z' },
  { value: 'seatCreatedAt_desc', label: 'Seat assigned (newest)' },
];

const OPUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Opus %' },
  { value: '0-30', label: 'Opus < 30%' },
  { value: '30-50', label: 'Opus 30–50%' },
  { value: '50-75', label: 'Opus 50–75%' },
  { value: '75-100', label: 'Opus 75–100%' },
] as const;

type OpusFilter = typeof OPUS_FILTER_OPTIONS[number]['value'];

const EDITOR_LABELS: Record<string, string> = {
  vscode: 'VS Code',
  jetbrains: 'JetBrains',
  visualstudio: 'Visual Studio',
  vim: 'Vim',
  neovim: 'Neovim',
  xcode: 'Xcode',
};

function calcOpusPct(u: UserModelStat): number {
  if (!u.totalInteractions) return 0;
  const opus = u.models
    .filter((m) => isOpusModel(m.model))
    .reduce((s, m) => s + m.interactions, 0);
  return Math.round((opus / u.totalInteractions) * 100);
}

// ── User model drawer ─────────────────────────────────────────────────
function UserModelDrawer({
  userLogin,
  modelMap,
  onClose,
}: {
  userLogin: string;
  modelMap: Record<string, UserModelStat>;
  onClose: () => void;
}) {
  const u = modelMap[userLogin];
  const opusInteractions = u
    ? u.models.filter((m) => isOpusModel(m.model)).reduce((s, m) => s + m.interactions, 0)
    : 0;
  const opusPct = u && u.totalInteractions > 0
    ? Math.round((opusInteractions / u.totalInteractions) * 100)
    : 0;
  const opusColor = opusPct > 50 ? '#7c3aed' : opusPct > 20 ? '#a78bfa' : '#6e7681';

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute right-0 top-0 h-full w-[440px] bg-[#0d1117] border-l border-gh-border shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gh-border shrink-0">
          <div className="flex items-center gap-3">
            {u?.userId ? (
              <img
                src={`https://avatars.githubusercontent.com/u/${u.userId}?size=36`}
                className="w-9 h-9 rounded-full bg-gh-canvas-subtle border border-gh-border"
                alt=""
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gh-canvas-subtle border border-gh-border flex items-center justify-center text-gh-fg-muted text-sm font-mono">
                {userLogin[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-mono text-sm font-semibold text-gh-fg">{userLogin}</p>
              <p className="text-xs text-gh-fg-muted">Model usage summary</p>
            </div>
          </div>
          <button onClick={onClose} className="gh-btn p-1.5 hover:bg-gh-canvas-subtle rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!u ? (
          <div className="flex-1 flex items-center justify-center text-gh-fg-muted text-sm">
            No model usage data for this user
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Opus % card */}
            <div className="rounded-lg border border-gh-border bg-gh-canvas-subtle p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-semibold text-gh-fg-subtle uppercase tracking-wider">
                  Opus Share of AI Usage
                </p>
                <span className="text-3xl font-bold tabular-nums" style={{ color: opusColor }}>
                  {opusPct}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[#161b22] overflow-hidden mb-1.5">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${opusPct}%`, backgroundColor: '#7c3aed' }}
                />
              </div>
              <p className="text-xs text-gh-fg-muted">
                {opusInteractions.toLocaleString()} of {u.totalInteractions.toLocaleString()} interactions with Opus models
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {([
                ['Total Interactions', u.totalInteractions.toLocaleString()],
                ['Acceptance Rate', `${u.acceptanceRate}%`],
                ['LoC Suggested', u.locSuggestedAdd.toLocaleString()],
                ['LoC Accepted', u.locAdded.toLocaleString()],
                ['Chat', u.chatInteractions.toLocaleString()],
                ['Agent', u.agentInteractions.toLocaleString()],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="rounded-md border border-gh-border bg-gh-canvas-subtle p-3">
                  <p className="text-xs text-gh-fg-muted mb-0.5">{label}</p>
                  <p className="text-lg font-semibold text-gh-fg tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            {/* Model breakdown chart */}
            <div className="rounded-lg border border-gh-border bg-gh-canvas-subtle p-4">
              <p className="text-xs font-semibold text-gh-fg-subtle uppercase tracking-wider mb-3">
                Model Breakdown
              </p>
              <ResponsiveContainer
                width="100%"
                height={Math.max(80, u.models.length * 26 + 20)}
              >
                <BarChart
                  data={[...u.models].sort((a, b) => a.interactions - b.interactions)}
                  layout="vertical"
                  margin={{ left: 135, right: 55, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fill: '#7d8590', fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="model"
                    tick={{ fill: '#e6edf3', fontSize: 11, fontFamily: 'monospace' }}
                    width={125}
                  />
                  <Tooltip
                    contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }}
                    labelStyle={{ color: '#e6edf3', fontFamily: 'monospace', fontSize: 11 }}
                    formatter={(v: number) => [v.toLocaleString(), 'interactions']}
                  />
                  <Bar
                    dataKey="interactions"
                    radius={[0, 3, 3, 0]}
                    label={{
                      position: 'right',
                      fill: '#7d8590',
                      fontSize: 10,
                      formatter: (v: number) => v.toLocaleString(),
                    }}
                  >
                    {u.models.map((m) => (
                      <Cell key={m.model} fill={modelColor(m.model)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ActivityStatus }) {
  const map: Record<ActivityStatus, string> = {
    active: 'bg-green-900/40 text-green-400 border border-green-800',
    recent: 'bg-blue-900/40 text-blue-400 border border-blue-800',
    dormant: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
    never: 'bg-gray-800 text-gh-fg-muted border border-gh-border',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status]}`}>
      {status === 'active' ? '● Active' : status === 'recent' ? '◐ Recent' : status === 'dormant' ? '○ Dormant' : '— Never'}
    </span>
  );
}

function EditorBadge({ name, version }: { name: string | null; version: string | null }) {
  if (!name) return <span className="text-xs text-gh-fg-subtle">—</span>;
  const label = EDITOR_LABELS[name] ?? name;
  const ver = version ? ` ${version.split('.').slice(0, 2).join('.')}` : '';
  return <span className="text-xs text-gh-fg">{label}<span className="text-gh-fg-subtle">{ver}</span></span>;
}

export function DetailedReportPage() {
  const [filters, setFilters] = useState<SeatsFilters>({
    status: 'all',
    sort: 'lastActivityAt_desc',
    page: 1,
    pageSize: 25,
  });
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [opusFilter, setOpusFilter] = useState<OpusFilter>('all');
  const [opusSort, setOpusSort] = useState<'asc' | 'desc' | null>(null);

  function toggleOpusSort() {
    setOpusSort((s) => s === 'desc' ? 'asc' : 'desc');
    setFilters((f) => ({ ...f, page: 1 }));
  }

  // When opus filter or sort is active fetch all seats at once for client-side processing
  const fetchingAll = opusFilter !== 'all' || opusSort !== null;
  const effectiveFilters = fetchingAll ? { ...filters, page: 1, pageSize: 2000 } : filters;

  const { data, isLoading } = useSeats({ ...effectiveFilters, search: search || undefined });
  const { data: editors } = useEditors();

  // Load all model usage users so we can show Opus % per row
  const { data: modelUsageData } = useModelUsageUsers({ pageSize: 1000, sort: 'interactions_desc' });
  const modelMap = useMemo<Record<string, UserModelStat>>(() => {
    const m: Record<string, UserModelStat> = {};
    for (const u of modelUsageData?.users ?? []) m[u.userLogin] = u;
    return m;
  }, [modelUsageData]);

  // Client-side opus filter + sort
  const opusFiltered = useMemo(() => {
    if (!data?.items) return [];
    let items = data.items as SeatRow[];
    if (opusFilter !== 'all') {
      items = items.filter((row) => {
        const mu = modelMap[row.userLogin];
        if (!mu) return false;
        const pct = calcOpusPct(mu);
        if (opusFilter === '0-30') return pct < 30;
        if (opusFilter === '30-50') return pct >= 30 && pct < 50;
        if (opusFilter === '50-75') return pct >= 50 && pct < 75;
        if (opusFilter === '75-100') return pct >= 75;
        return true;
      });
    }
    if (opusSort !== null) {
      items = [...items].sort((a, b) => {
        const pa = calcOpusPct(modelMap[a.userLogin] ?? { totalInteractions: 0, models: [] } as unknown as UserModelStat);
        const pb = calcOpusPct(modelMap[b.userLogin] ?? { totalInteractions: 0, models: [] } as unknown as UserModelStat);
        return opusSort === 'desc' ? pb - pa : pa - pb;
      });
    }
    return items;
  }, [data?.items, opusFilter, opusSort, modelMap]);

  const clientPage = filters.page ?? 1;
  const clientPageSize = filters.pageSize ?? 25;
  const visibleItems = fetchingAll
    ? opusFiltered.slice((clientPage - 1) * clientPageSize, clientPage * clientPageSize)
    : opusFiltered;
  const displayTotal = fetchingAll ? opusFiltered.length : (data?.total ?? 0);
  const totalPages = displayTotal > 0 ? Math.ceil(displayTotal / clientPageSize) : 0;

  // CSV export — all filtered data (all pages)
  function exportCsv() {
    const allRows = fetchingAll ? opusFiltered : (data?.items ?? []);
    // Collect all unique model names across exported users
    const allModels = Array.from(
      new Set(allRows.flatMap((row: SeatRow) => modelMap[row.userLogin]?.models.map((m) => m.model) ?? []))
    ).sort();

    const headers = [
      'username', 'status', 'last_active', 'editor', 'editor_version', 'plan',
      'seat_assigned', 'accept_pct', 'opus_pct',
      'total_interactions', 'chat_interactions', 'agent_interactions',
      'loc_suggested', 'loc_accepted',
      ...allModels.map((m) => `model:${m}`),
    ];

    const csvRows = allRows.map((row: SeatRow) => {
      const mu = modelMap[row.userLogin];
      const opusPct = mu ? calcOpusPct(mu) : '';
      const modelInteractions = allModels.map((m) =>
        mu?.models.find((x) => x.model === m)?.interactions ?? 0
      );
      return [
        row.userLogin,
        row.activityStatus,
        row.lastActivityAt ? format(new Date(row.lastActivityAt), 'yyyy-MM-dd HH:mm') : '',
        row.editorName ?? '',
        row.editorVersion ?? '',
        row.planType ?? '',
        format(new Date(row.seatCreatedAt), 'yyyy-MM-dd'),
        mu?.acceptanceRate ?? '',
        opusPct,
        mu?.totalInteractions ?? '',
        mu?.chatInteractions ?? '',
        mu?.agentInteractions ?? '',
        mu?.locSuggestedAdd ?? '',
        mu?.locAdded ?? '',
        ...modelInteractions,
      ];
    });

    const csv = [headers, ...csvRows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copilot-seats-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function setFilter<K extends keyof SeatsFilters>(key: K, value: SeatsFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gh-fg">Seat Report</h1>
        <p className="text-sm text-gh-fg-muted mt-0.5">All assigned Copilot seats with activity details</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-gh-fg-muted" />
          <input
            className="gh-input pl-8 w-full"
            placeholder="Search user..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFilters((f) => ({ ...f, page: 1 })); }}
          />
        </div>

        <select className="gh-select" value={filters.status ?? 'all'}
          onChange={(e) => setFilter('status', e.target.value as SeatsFilters['status'])}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select className="gh-select" value={filters.editor ?? 'all'}
          onChange={(e) => setFilter('editor', e.target.value === 'all' ? undefined : e.target.value)}>
          <option value="all">All editors</option>
          {(editors ?? []).map((e) => (
            <option key={e} value={e}>{EDITOR_LABELS[e] ?? e}</option>
          ))}
        </select>

        <select className="gh-select" value={filters.sort ?? 'lastActivityAt_desc'}
          onChange={(e) => setFilter('sort', e.target.value as SeatsFilters['sort'])}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select className="gh-select w-20" value={filters.pageSize ?? 25}
          onChange={(e) => setFilter('pageSize', Number(e.target.value))}>
          {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>

        <select className="gh-select" value={opusFilter}
          onChange={(e) => { setOpusFilter(e.target.value as OpusFilter); setFilters((f) => ({ ...f, page: 1 })); }}>
          {OPUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button
          className="gh-btn flex items-center gap-1.5 px-3 py-1.5 text-sm"
          onClick={exportCsv}
          title="Export filtered results to CSV"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="gh-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="gh-table min-w-full">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Feature</th>
                <th>Last Active</th>
                <th>Editor</th>
                <th>Seat Assigned</th>
                <th>Plan</th>
                <th title="Acceptance rate: lines accepted / lines suggested">Accept %</th>
                <th
                  title="% of interactions using Claude Opus models — click to sort"
                  className="cursor-pointer select-none hover:text-gh-fg transition-colors"
                  onClick={toggleOpusSort}
                >
                  <span className="inline-flex items-center gap-1">
                    Opus %
                    <span className="text-gh-fg-muted">{opusSort === 'desc' ? ' ↓' : opusSort === 'asc' ? ' ↑' : ' ↕'}</span>
                  </span>
                </th>
                <th title="Total AI interactions in the data period">Interactions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}><td colSpan={10}><div className="h-5 bg-gh-border rounded animate-pulse" /></td></tr>
              ))}
              {!isLoading && visibleItems.length === 0 && (
                <tr><td colSpan={10} className="text-center py-8 text-gh-fg-muted">No seats match the current filters.</td></tr>
              )}
              {visibleItems.map((row: SeatRow) => {
                const mu = modelMap[row.userLogin];
                const opusPct = mu ? calcOpusPct(mu) : null;
                const acceptRate = mu ? mu.acceptanceRate : null;
                return (
                  <tr
                    key={row.userLogin}
                    className="cursor-pointer hover:bg-gh-canvas-subtle transition-colors"
                    onClick={() => setSelectedUser(row.userLogin)}
                  >
                    <td>
                      <span className="font-mono text-xs text-gh-accent-emphasis">{row.userLogin}</span>
                    </td>
                    <td><StatusBadge status={row.activityStatus} /></td>
                    <td>
                      <span className="text-xs text-gh-fg-muted">{row.isSeated ? row.feature : 'Enterprise'}</span>
                    </td>
                    <td>
                      <span className="text-xs text-gh-fg-muted">
                        {row.lastActivityAt ? format(new Date(row.lastActivityAt), 'MMM d, yyyy') : '—'}
                      </span>
                    </td>
                    <td><EditorBadge name={row.editorName} version={row.editorVersion} /></td>
                    <td>
                      {row.isSeated
                        ? <span className="text-xs text-gh-fg-muted">{format(new Date(row.seatCreatedAt), 'MMM d, yyyy')}</span>
                        : <span className="text-xs px-1.5 py-0.5 rounded bg-[#1f2937] border border-[#374151] text-[#9ca3af]" title="Enterprise license — no org seat assigned">No org seat</span>
                      }
                    </td>
                    <td>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gh-canvas-subtle border border-gh-border text-gh-fg-muted">
                        {row.planType ?? '—'}
                      </span>
                      {row.pendingCancellationDate && (
                        <span className="ml-1 text-xs text-gh-danger">cancels {format(new Date(row.pendingCancellationDate), 'MMM d')}</span>
                      )}
                    </td>
                    <td>
                      {acceptRate === null ? (
                        <span className="text-xs text-gh-fg-subtle">—</span>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-[68px]">
                          <div className="flex-1 h-1.5 rounded-full bg-[#161b22] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${acceptRate}%`,
                                backgroundColor: acceptRate >= 30 ? '#34d399' : acceptRate >= 10 ? '#fbbf24' : '#f87171',
                              }}
                            />
                          </div>
                          <span className="text-xs tabular-nums w-7 text-right text-gh-fg-muted">{acceptRate}%</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {opusPct === null ? (
                        <span className="text-xs text-gh-fg-subtle">—</span>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-[68px]">
                          <div className="flex-1 h-1.5 rounded-full bg-[#161b22] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${opusPct}%`,
                                backgroundColor: opusPct > 50 ? '#7c3aed' : opusPct > 20 ? '#a78bfa' : '#6d28d9',
                              }}
                            />
                          </div>
                          <span
                            className="text-xs tabular-nums w-7 text-right"
                            style={{ color: opusPct > 0 ? '#a78bfa' : '#6e7681' }}
                          >
                            {opusPct}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      {mu ? (
                        <span className="text-xs tabular-nums text-gh-fg-muted">{mu.totalInteractions.toLocaleString()}</span>
                      ) : (
                        <span className="text-xs text-gh-fg-subtle">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {displayTotal > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gh-border text-sm text-gh-fg-muted">
            <span>{(clientPage - 1) * clientPageSize + 1}–{Math.min(clientPage * clientPageSize, displayTotal)} of {displayTotal} seats{opusFilter !== 'all' ? ' (filtered)' : ''}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setFilter('page', (filters.page ?? 1) - 1)}
                disabled={(filters.page ?? 1) <= 1} className="gh-btn p-1 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2">Page {filters.page} of {totalPages}</span>
              <button onClick={() => setFilter('page', (filters.page ?? 1) + 1)}
                disabled={(filters.page ?? 1) >= totalPages} className="gh-btn p-1 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User model drawer */}
      {selectedUser && (
        <UserModelDrawer
          userLogin={selectedUser}
          modelMap={modelMap}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </AppLayout>
  );
}

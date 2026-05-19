import { RefreshCw, Users, Clock, AlertTriangle, Activity, Zap, Code2, TrendingUp } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { AppLayout } from '../components/layout/AppLayout';
import { useSummary, useTriggerIngestion, useModelUsageSummary } from '../hooks/useUsage';
import { EditorChart } from '../components/dashboard/EditorChart';
import { FeatureChart } from '../components/dashboard/FeatureChart';
import { modelColor } from '../utils/modelColors';

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <div className="gh-card p-4 flex gap-3 items-start">
      <div className={`mt-0.5 p-2 rounded-md ${color ?? 'bg-gh-accent/10 text-gh-accent-emphasis'}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-gh-fg-muted uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-semibold text-gh-fg">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {sub && <p className="text-xs text-gh-fg-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function OverviewPage() {
  const { data, isLoading, isError } = useSummary();
  const { data: usage, isLoading: usageLoading } = useModelUsageSummary();
  const trigger = useTriggerIngestion();

  const snap = data?.snapshot;
  const act = data?.activity;
  const lastSync = data?.lastSyncAt ? formatDistanceToNow(new Date(data.lastSyncAt), { addSuffix: true }) : 'never';

  const dateRange = usage?.dateFrom && usage?.dateTo
    ? `${format(new Date(usage.dateFrom), 'MMM d')} – ${format(new Date(usage.dateTo), 'MMM d, yyyy')}`
    : null;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gh-fg">Overview</h1>
          <p className="text-sm text-gh-fg-muted mt-0.5">
            GitHub Copilot usage across the enterprise — seats synced {lastSync}
          </p>
        </div>
        <button
          className="gh-btn-primary flex items-center gap-2 text-sm"
          onClick={() => trigger.mutate()}
          disabled={trigger.isPending}
        >
          <RefreshCw className={`w-4 h-4 ${trigger.isPending ? 'animate-spin' : ''}`} />
          {trigger.isPending ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {isError && (
        <div className="flex items-center gap-2 text-gh-danger text-sm bg-[#3d1515] border border-gh-danger/30 rounded-md px-4 py-3 mb-4">
          <AlertTriangle className="w-4 h-4" />
          Failed to load data. Make sure the backend is running.
        </div>
      )}

      {/* ── Seat stats ──────────────────────────────────────────────── */}
      <h2 className="text-xs font-semibold text-gh-fg-muted uppercase tracking-wider mb-3">Seat Allocation</h2>
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="gh-card p-4 h-24 animate-pulse bg-gh-canvas-subtle" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Seats" value={snap?.totalSeats ?? 0} icon={Users} />
          <StatCard label="Active 7d" value={act?.activeWeek ?? 0} icon={Activity}
            color="bg-blue-900/30 text-gh-accent-emphasis" sub="used in last 7 days" />
          <StatCard label="Never Active" value={act?.neverActive ?? 0} icon={Clock}
            color="bg-gray-800 text-gh-fg-muted" sub="no activity recorded" />
        </div>
      )}

      {/* ── AI Interaction stats (current month) ─────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gh-fg-muted uppercase tracking-wider">
          AI Interactions
          {dateRange && <span className="ml-2 normal-case font-normal">{dateRange}</span>}
        </h2>
      </div>
      {usageLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="gh-card p-4 h-24 animate-pulse bg-gh-canvas-subtle" />
          ))}
        </div>
      ) : usage ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Interactions" value={fmt(usage.totalInteractions)} icon={Zap}
            color="bg-purple-900/30 text-purple-400" sub={`across ${usage.uniqueModels} models`} />
          <StatCard label="Active Users" value={usage.uniqueUsers} icon={Users}
            color="bg-blue-900/30 text-gh-accent-emphasis" sub="users with AI interactions" />
          <StatCard label="LoC Suggested" value={fmt(usage.locSuggestedAdd)} icon={Code2}
            color="bg-indigo-900/30 text-indigo-400" sub="lines of code suggested" />
          <StatCard label="LoC Accepted" value={fmt(usage.locAdded)} icon={TrendingUp}
            color="bg-green-900/30 text-gh-success" sub="lines of code accepted" />
        </div>
      ) : null}

      {/* ── Top models table ────────────────────────────────────────── */}
      {usage && usage.topModels.length > 0 && (
        <div className="gh-card overflow-hidden p-0 mb-8">
          <div className="px-4 py-3 border-b border-gh-border">
            <h3 className="text-sm font-semibold text-gh-fg">
              Top Models
              <span className="ml-2 text-xs font-normal text-gh-fg-muted">by interactions · {dateRange}</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            {/* header */}
            <div className="grid text-xs font-medium text-gh-fg-muted uppercase tracking-wide bg-gh-canvas-subtle border-b border-gh-border px-3 py-2"
              style={{ gridTemplateColumns: '28% 14% 10% 16% 16% 16%' }}>
              <span>Model</span>
              <span className="text-right">Interactions</span>
              <span className="text-right">Users</span>
              <span className="text-right">LoC Suggested</span>
              <span className="text-right">LoC Accepted</span>
              <span className="text-right">Code Gen</span>
            </div>
            {/* rows */}
            {usage.topModels.slice(0, 10).map((m) => {
              const color = modelColor(m.model);
              const pct = Math.round((m.interactions / usage.totalInteractions) * 100);
              return (
                <div key={m.model}
                  className="grid items-center px-3 py-2.5 border-b border-gh-border-muted text-sm hover:bg-gh-canvas-subtle"
                  style={{ gridTemplateColumns: '28% 14% 10% 16% 16% 16%' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <span className="font-mono text-xs text-gh-fg truncate">{m.model}</span>
                    <span className="text-xs text-gh-fg-muted shrink-0">{pct}%</span>
                  </div>
                  <span className="text-right font-mono">{m.interactions.toLocaleString()}</span>
                  <span className="text-right text-gh-fg-muted">{m.users.toLocaleString()}</span>
                  <span className="text-right font-mono">{m.locSuggestedAdd.toLocaleString()}</span>
                  <span className="text-right font-mono">{m.locAdded.toLocaleString()}</span>
                  <span className="text-right text-gh-fg-muted">{m.codeGenCount.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Editor + Feature charts ──────────────────────────────────── */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data?.features && data.features.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gh-fg-muted uppercase tracking-wider mb-3">
                Copilot Feature Usage
                <span className="ml-2 normal-case font-normal text-gh-fg-muted">(by last activity)</span>
              </h2>
              <FeatureChart data={data.features} />
            </div>
          )}
          {data?.editors && data.editors.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gh-fg-muted uppercase tracking-wider mb-3">
                Editor Distribution
                <span className="ml-2 normal-case font-normal text-gh-fg-muted">(by last activity)</span>
              </h2>
              <EditorChart data={data.editors} />
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}

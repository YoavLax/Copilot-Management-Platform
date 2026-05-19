import { RefreshCw, CheckCircle, XCircle, Clock, Database, PlayCircle, BarChart2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../components/layout/AppLayout';
import { useIngestionRuns } from '../hooks/useUsage';
import { api } from '../api/client';
import type { IngestionRun } from '../types';

function StatusBadge({ status }: { status: string }) {
  if (status === 'success')
    return <span className="badge badge-green flex items-center gap-1"><CheckCircle className="w-3 h-3" /> success</span>;
  if (status === 'failed')
    return <span className="badge" style={{ background: '#3d1515', color: '#f85149', border: '1px solid #f8514940' }}><XCircle className="w-3 h-3 inline mr-1" /> failed</span>;
  if (status === 'running')
    return <span className="badge badge-blue flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> running</span>;
  return <span className="badge badge-gray">{status}</span>;
}

export function DataPipelinePage() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useIngestionRuns();

  const triggerMutation = useMutation({
    mutationFn: () => api.triggerIngestion(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingestion-runs'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      queryClient.invalidateQueries({ queryKey: ['seats'] });
    },
  });

  const usageSyncMutation = useMutation({
    mutationFn: () => api.syncModelUsage(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-usage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['model-usage-users'] });
      queryClient.invalidateQueries({ queryKey: ['model-usage-models'] });
    },
  });

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gh-fg">Data Pipeline</h1>
          <p className="text-sm text-gh-fg-muted mt-0.5">Seat sync history and manual trigger</p>
        </div>
        <button onClick={() => refetch()} className="gh-btn flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Manual seat sync trigger */}
      <div className="gh-card mb-4">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-gh-canvas rounded-md">
            <Database className="w-5 h-5 text-gh-accent-emphasis" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gh-fg">Manual Seat Sync</h3>
            <p className="text-xs text-gh-fg-muted mt-0.5 mb-3">
              Syncs all Copilot seats from GitHub. This fetches the latest seat activity data and
              upserts all 749+ user records. Safe to run at any time — fully idempotent.
            </p>
            <button
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending}
              className="gh-btn-primary flex items-center gap-1.5"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              {triggerMutation.isPending ? 'Syncing…' : 'Run Sync Now'}
            </button>
            {triggerMutation.isSuccess && (
              <p className="text-xs text-gh-success mt-2">
                ✓ Sync completed — {(triggerMutation.data as { recordsProcessed?: number })?.recordsProcessed ?? 0} seats synced
              </p>
            )}
            {triggerMutation.isError && (
              <p className="text-xs text-gh-danger mt-2">Sync failed: {(triggerMutation.error as Error).message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Usage metrics sync trigger */}
      <div className="gh-card mb-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-gh-canvas rounded-md">
            <BarChart2 className="w-5 h-5 text-gh-accent-emphasis" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gh-fg">Sync Usage Metrics</h3>
            <p className="text-xs text-gh-fg-muted mt-0.5 mb-3">
              Fetches usage for the current month only, per user and per model, directly from the GitHub Copilot
              metrics API. Replaces any manual NDJSON import. Runs automatically every night at 06:00 UTC.
            </p>
            <button
              onClick={() => usageSyncMutation.mutate()}
              disabled={usageSyncMutation.isPending}
              className="gh-btn-primary flex items-center gap-1.5"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              {usageSyncMutation.isPending ? 'Syncing…' : 'Sync Now (Current Month)'}
            </button>
            {usageSyncMutation.isSuccess && (
              <p className="text-xs text-gh-success mt-2">
                ✓ Sync completed — {(usageSyncMutation.data as { recordsLoaded?: number })?.recordsLoaded ?? 0} records loaded
              </p>
            )}
            {usageSyncMutation.isError && (
              <p className="text-xs text-gh-danger mt-2">Sync failed: {(usageSyncMutation.error as Error).message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Run history */}
      <div className="gh-card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-gh-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gh-fg">Recent Runs</h3>
          <span className="text-xs text-gh-fg-muted">Auto-refreshes every 10s</span>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-gh-border rounded" />)}
          </div>
        ) : (
          <table className="gh-table w-full">
            <thead>
              <tr>
                <th>Org</th>
                <th>Status</th>
                <th className="text-right">Seats Synced</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {(!data || data.length === 0) && (
                <tr><td colSpan={6} className="text-center py-8 text-gh-fg-muted">No sync runs yet.</td></tr>
              )}
              {(data ?? []).map((run: IngestionRun) => (
                <tr key={run.id}>
                  <td className="font-mono text-xs">{run.orgSlug}</td>
                  <td><StatusBadge status={run.status} /></td>
                  <td className="text-right text-gh-fg-muted text-sm">{run.recordsProcessed.toLocaleString()}</td>
                  <td className="text-xs text-gh-fg-muted">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(run.startedAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="text-xs text-gh-fg-muted">
                    {run.completedAt ? new Date(run.completedAt).toLocaleString() : '—'}
                  </td>
                  <td className="text-xs text-gh-danger max-w-xs truncate">{run.errorMessage ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  );
}

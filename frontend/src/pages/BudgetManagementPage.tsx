import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Save, Users, Wallet } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AppLayout } from '../components/layout/AppLayout';
import { useBudgets, useBudgetTeams, useOrgs, useTeamBudgetUpdate, useTeamMembers, useUpdateBudget, useUpsertBudget } from '../hooks/useUsage';
import type { BudgetItem, TeamBudgetUpdateResult, TeamBudgetUpdateStatus } from '../types';

const DEFAULT_BUDGET_TARGET = 'premium_requests';

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function ResultBadge({ status }: { status: TeamBudgetUpdateStatus }) {
  if (status === 'created') return <span className="badge-blue">Created</span>;
  if (status === 'updated') return <span className="badge-green">Updated</span>;
  if (status === 'skipped_no_existing_budget') return <span className="badge-orange">Skipped</span>;
  return <span className="badge" style={{ background: '#3d1515', color: '#f85149', border: '1px solid #f8514940' }}>Failed</span>;
}

function BudgetTableRow({
  budget,
  selected,
  onSelect,
}: {
  budget: BudgetItem;
  selected: boolean;
  onSelect: (budget: BudgetItem) => void;
}) {
  return (
    <tr onClick={() => onSelect(budget)} className={selected ? 'bg-gh-canvas-subtle' : undefined}>
      <td className="font-mono text-xs">{budget.user ?? '—'}</td>
      <td>{formatCurrency(budget.budgetAmount)}</td>
      <td className="text-gh-fg-muted">{formatCurrency(budget.currentAmount)}</td>
      <td className="text-xs text-gh-fg-muted">{budget.budgetScope ?? '—'}</td>
      <td className="text-xs text-gh-fg-muted">{budget.budgetProductSku ?? '—'}</td>
      <td>{budget.alertsEnabled ? <span className="badge-green">Enabled</span> : <span className="badge-gray">Disabled</span>}</td>
      <td>{budget.preventFurtherUsage ? <span className="badge-orange">Block on limit</span> : <span className="badge-gray">Track only</span>}</td>
      <td className="text-xs text-gh-fg-muted">
        {budget.updatedAt ? formatDistanceToNow(new Date(budget.updatedAt), { addSuffix: true }) : '—'}
      </td>
    </tr>
  );
}

function GeneralBudgetTableRow({
  budget,
  selected,
  onSelect,
}: {
  budget: BudgetItem;
  selected: boolean;
  onSelect: (budget: BudgetItem) => void;
}) {
  return (
    <tr onClick={() => onSelect(budget)} className={selected ? 'bg-gh-canvas-subtle' : undefined}>
      <td className="text-xs text-gh-fg-muted">{budget.budgetScope ?? '—'}</td>
      <td>{formatCurrency(budget.budgetAmount)}</td>
      <td className="text-gh-fg-muted">{formatCurrency(budget.currentAmount)}</td>
      <td className="text-xs text-gh-fg-muted">{budget.budgetProductSku ?? '—'}</td>
      <td>{budget.preventFurtherUsage ? <span className="badge-orange">Block on limit</span> : <span className="badge-gray">Track only</span>}</td>
      <td className="text-xs text-gh-fg-muted">
        {budget.updatedAt ? formatDistanceToNow(new Date(budget.updatedAt), { addSuffix: true }) : '—'}
      </td>
    </tr>
  );
}

export function BudgetManagementPage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [targetUserInput, setTargetUserInput] = useState('');
  const [budgetAmountInput, setBudgetAmountInput] = useState('');

  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedTeamSlug, setSelectedTeamSlug] = useState('');
  const [teamBudgetAmountInput, setTeamBudgetAmountInput] = useState('');

  const budgetsQuery = useBudgets({ budgetTarget: DEFAULT_BUDGET_TARGET });
  const orgsQuery = useOrgs();
  const teamsQuery = useBudgetTeams(selectedOrg || undefined);
  const membersQuery = useTeamMembers(selectedOrg || undefined, selectedTeamSlug || undefined);

  const updateBudgetMutation = useUpdateBudget();
  const upsertBudgetMutation = useUpsertBudget();
  const teamUpdateMutation = useTeamBudgetUpdate();

  const allBudgets = budgetsQuery.data?.items ?? [];

  const personalBudgets = useMemo(
    () => allBudgets.filter((budget) => Boolean(budget.user)),
    [allBudgets]
  );

  const generalBudgets = useMemo(
    () => allBudgets.filter((budget) => !budget.user),
    [allBudgets]
  );

  const budgets = useMemo(
    () => personalBudgets.filter((budget) => !deferredSearch || budget.user?.toLowerCase().includes(deferredSearch.toLowerCase())),
    [deferredSearch, personalBudgets]
  );

  useEffect(() => {
    if (!selectedBudgetId && allBudgets.length > 0) {
      setSelectedBudgetId(allBudgets[0].id);
    }
  }, [allBudgets, selectedBudgetId]);

  const selectedBudget = useMemo(
    () => allBudgets.find((budget) => budget.id === selectedBudgetId) ?? null,
    [allBudgets, selectedBudgetId]
  );

  const isEditingExistingBudget = Boolean(selectedBudget);

  useEffect(() => {
    if (selectedBudget) {
      setTargetUserInput(selectedBudget.user ?? '');
      setBudgetAmountInput(selectedBudget.budgetAmount.toFixed(2));
    }
  }, [selectedBudget]);

  const availableOrgs = useMemo(
    () => (orgsQuery.data ?? []).filter((org) => org.org !== '_unknown'),
    [orgsQuery.data]
  );

  useEffect(() => {
    if (!selectedOrg && availableOrgs.length > 0) {
      setSelectedOrg(availableOrgs[0].org);
    }
  }, [availableOrgs, selectedOrg]);

  const teams = teamsQuery.data?.items ?? [];

  useEffect(() => {
    if (!selectedOrg) return;
    if (!selectedTeamSlug && teams.length > 0) {
      setSelectedTeamSlug(teams[0].slug);
      return;
    }
    if (selectedTeamSlug && !teams.some((team) => team.slug === selectedTeamSlug)) {
      setSelectedTeamSlug(teams[0]?.slug ?? '');
    }
  }, [selectedOrg, selectedTeamSlug, teams]);

  const teamMembers = membersQuery.data?.items ?? [];

  const handleSingleBudgetSave = () => {
    const parsedAmount = Number(budgetAmountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    if (selectedBudget) {
      updateBudgetMutation.mutate({
        budgetId: selectedBudget.id,
        budgetAmount: parsedAmount,
      });
      return;
    }

    const user = targetUserInput.trim();
    if (!user) return;

    upsertBudgetMutation.mutate({
      user,
      budgetAmount: parsedAmount,
      budgetTarget: DEFAULT_BUDGET_TARGET,
      preventFurtherUsage: true,
    });
  };

  const handleTeamUpdate = () => {
    const parsedAmount = Number(teamBudgetAmountInput);
    if (!selectedOrg || !selectedTeamSlug || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    teamUpdateMutation.mutate({
      org: selectedOrg,
      teamSlug: selectedTeamSlug,
      budgetAmount: parsedAmount,
      budgetTarget: DEFAULT_BUDGET_TARGET,
      createIfMissing: true,
      preventFurtherUsage: true,
    });
  };

  const teamResults = teamUpdateMutation.data?.results ?? [];

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gh-fg">Budget Management</h1>
          <p className="text-sm text-gh-fg-muted mt-0.5">
            Manage enterprise budgets, create per-user overrides, and update existing personal budgets.
          </p>
        </div>
        <button onClick={() => budgetsQuery.refetch()} className="gh-btn flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${budgetsQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh budgets
        </button>
      </div>

      <section className="gh-card overflow-hidden p-0 mb-6">
        <div className="px-4 py-3 border-b border-gh-border">
          <h2 className="text-sm font-semibold text-gh-fg">General Budgets</h2>
          <p className="text-xs text-gh-fg-muted mt-0.5">
            {generalBudgets.length} enterprise or inherited budgets for {DEFAULT_BUDGET_TARGET}
          </p>
        </div>

        <div className="overflow-auto">
          <table className="gh-table w-full">
            <thead>
              <tr>
                <th>Scope</th>
                <th>Budget</th>
                <th>Current</th>
                <th>SKU</th>
                <th>Enforcement</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {budgetsQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gh-fg-muted">Loading general budgets…</td>
                </tr>
              )}
              {!budgetsQuery.isLoading && generalBudgets.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gh-fg-muted">No general budgets found.</td>
                </tr>
              )}
              {generalBudgets.map((budget) => (
                <GeneralBudgetTableRow
                  key={budget.id}
                  budget={budget}
                  selected={budget.id === selectedBudgetId}
                  onSelect={(item) => setSelectedBudgetId(item.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_420px] gap-6 mb-6">
        <section className="gh-card overflow-hidden p-0">
          <div className="px-4 py-3 border-b border-gh-border flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gh-fg">Personal Budgets</h2>
              <p className="text-xs text-gh-fg-muted mt-0.5">
                {personalBudgets.length} personal overrides for {DEFAULT_BUDGET_TARGET}
              </p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="gh-input w-64"
              placeholder="Search by GitHub login"
            />
          </div>

          {budgetsQuery.isError && (
            <div className="m-4 flex items-center gap-2 text-gh-danger text-sm bg-[#3d1515] border border-gh-danger/30 rounded-md px-4 py-3">
              <AlertTriangle className="w-4 h-4" />
              {(budgetsQuery.error as Error).message}
            </div>
          )}

          <div className="overflow-auto max-h-[520px]">
            <table className="gh-table w-full">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Budget</th>
                  <th>Current</th>
                  <th>Scope</th>
                  <th>SKU</th>
                  <th>Alerts</th>
                  <th>Enforcement</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {budgetsQuery.isLoading && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gh-fg-muted">Loading budgets…</td>
                  </tr>
                )}
                {!budgetsQuery.isLoading && budgets.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gh-fg-muted">No matching budgets found.</td>
                  </tr>
                )}
                {budgets.map((budget) => (
                  <BudgetTableRow
                    key={budget.id}
                    budget={budget}
                    selected={budget.id === selectedBudgetId}
                    onSelect={(item) => setSelectedBudgetId(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="gh-card">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-md bg-gh-canvas text-gh-accent-emphasis">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gh-fg">
                {isEditingExistingBudget ? 'Edit Selected Budget' : 'Create Or Update User Budget'}
              </h2>
              <p className="text-xs text-gh-fg-muted mt-0.5">
                {isEditingExistingBudget
                  ? 'Click any general or personal budget row to edit that existing budget directly.'
                  : 'If the user only inherits the org-level budget, the app will try to create a personal override. Your current GitHub budget API may reject that create operation.'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {isEditingExistingBudget ? (
              <div className="rounded-md border border-gh-border bg-gh-canvas-inset p-3">
                <p className="text-xs text-gh-fg-muted mb-1">Selected budget</p>
                <p className="font-mono text-sm text-gh-fg">
                  {selectedBudget?.user ?? selectedBudget?.budgetScope ?? '—'}
                </p>
                <p className="text-xs text-gh-fg-muted mt-1">
                  SKU: {selectedBudget?.budgetProductSku ?? '—'}
                </p>
              </div>
            ) : (
              <label className="block">
                <span className="text-xs text-gh-fg-muted block mb-1.5">GitHub user</span>
                <input
                  value={targetUserInput}
                  onChange={(event) => setTargetUserInput(event.target.value)}
                  className="gh-input w-full font-mono"
                  placeholder="octocat"
                />
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-gh-border bg-gh-canvas-inset p-3">
                <p className="text-xs text-gh-fg-muted mb-1">Current limit</p>
                <p className="text-lg font-semibold text-gh-fg">{formatCurrency(selectedBudget?.budgetAmount)}</p>
              </div>
              <div className="rounded-md border border-gh-border bg-gh-canvas-inset p-3">
                <p className="text-xs text-gh-fg-muted mb-1">Current usage</p>
                <p className="text-lg font-semibold text-gh-fg">{formatCurrency(selectedBudget?.currentAmount)}</p>
              </div>
            </div>

            <label className="block">
              <span className="text-xs text-gh-fg-muted block mb-1.5">New budget amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={budgetAmountInput}
                onChange={(event) => setBudgetAmountInput(event.target.value)}
                className="gh-input w-full"
              />
            </label>

            <button
              onClick={handleSingleBudgetSave}
              disabled={updateBudgetMutation.isPending || upsertBudgetMutation.isPending}
              className="gh-btn-primary w-full justify-center"
            >
              <Save className="w-4 h-4" />
              {updateBudgetMutation.isPending || upsertBudgetMutation.isPending
                ? 'Saving…'
                : isEditingExistingBudget
                  ? 'Update selected budget'
                  : 'Create or update budget'}
            </button>

            {isEditingExistingBudget && (
              <button
                onClick={() => {
                  setSelectedBudgetId(null);
                  setTargetUserInput('');
                  setBudgetAmountInput('');
                }}
                className="gh-btn w-full justify-center"
              >
                New user override
              </button>
            )}

            {updateBudgetMutation.isSuccess && (
              <p className="text-xs text-gh-success">Budget updated successfully.</p>
            )}
            {upsertBudgetMutation.isSuccess && !isEditingExistingBudget && (
              <p className="text-xs text-gh-success">
                {upsertBudgetMutation.data.action === 'created' ? 'Personal override created successfully.' : 'Budget updated successfully.'}
              </p>
            )}
            {updateBudgetMutation.isError && (
              <p className="text-xs text-gh-danger">{(updateBudgetMutation.error as Error).message}</p>
            )}
            {upsertBudgetMutation.isError && (
              <p className="text-xs text-gh-danger">{(upsertBudgetMutation.error as Error).message}</p>
            )}
          </div>
        </section>
      </div>

      <section className="gh-card">
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2 rounded-md bg-gh-canvas text-gh-accent-emphasis">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gh-fg">Team Budget Update</h2>
            <p className="text-xs text-gh-fg-muted mt-0.5">
              Select an org and team, preview members, then create or update personal overrides for each team member.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_220px_minmax(0,1fr)_220px] gap-4 items-start mb-5">
          <label className="block">
            <span className="text-xs text-gh-fg-muted block mb-1.5">Organization</span>
            <select
              value={selectedOrg}
              onChange={(event) => {
                setSelectedOrg(event.target.value);
                setSelectedTeamSlug('');
              }}
              className="gh-select w-full"
            >
              {availableOrgs.map((org) => (
                <option key={org.org} value={org.org}>{org.org}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-gh-fg-muted block mb-1.5">Team</span>
            <select
              value={selectedTeamSlug}
              onChange={(event) => setSelectedTeamSlug(event.target.value)}
              className="gh-select w-full"
              disabled={!selectedOrg || teamsQuery.isLoading}
            >
              {teams.map((team) => (
                <option key={team.slug} value={team.slug}>{team.name}</option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-xs text-gh-fg-muted block mb-1.5">Team members</span>
            <div className="rounded-md border border-gh-border bg-gh-canvas-inset p-3 min-h-[42px] max-h-40 overflow-auto">
              {membersQuery.isLoading && <p className="text-sm text-gh-fg-muted">Loading members…</p>}
              {!membersQuery.isLoading && teamMembers.length === 0 && (
                <p className="text-sm text-gh-fg-muted">No members found for this team.</p>
              )}
              {!membersQuery.isLoading && teamMembers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {teamMembers.map((member) => (
                    <span key={member.login} className="badge-gray font-mono">{member.login}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <label className="block">
            <span className="text-xs text-gh-fg-muted block mb-1.5">New budget amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={teamBudgetAmountInput}
              onChange={(event) => setTeamBudgetAmountInput(event.target.value)}
              className="gh-input w-full"
            />
            <button
              onClick={handleTeamUpdate}
              disabled={teamUpdateMutation.isPending || !selectedOrg || !selectedTeamSlug}
              className="gh-btn-primary w-full justify-center mt-3"
            >
              {teamUpdateMutation.isPending ? 'Updating…' : 'Apply team budget'}
            </button>
          </label>
        </div>

        {teamUpdateMutation.isError && (
          <div className="flex items-center gap-2 text-gh-danger text-sm bg-[#3d1515] border border-gh-danger/30 rounded-md px-4 py-3 mb-4">
            <AlertTriangle className="w-4 h-4" />
            {(teamUpdateMutation.error as Error).message}
          </div>
        )}

        {teamUpdateMutation.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-md border border-gh-border bg-gh-canvas-inset p-3">
                <p className="text-xs text-gh-fg-muted mb-1">Team members</p>
                <p className="text-xl font-semibold text-gh-fg">{teamUpdateMutation.data.totalMembers}</p>
              </div>
              <div className="rounded-md border border-gh-border bg-gh-canvas-inset p-3">
                <p className="text-xs text-gh-fg-muted mb-1">Created</p>
                <p className="text-xl font-semibold text-gh-accent-emphasis">{teamUpdateMutation.data.summary.created}</p>
              </div>
              <div className="rounded-md border border-gh-border bg-gh-canvas-inset p-3">
                <p className="text-xs text-gh-fg-muted mb-1">Updated</p>
                <p className="text-xl font-semibold text-gh-success">{teamUpdateMutation.data.summary.updated}</p>
              </div>
              <div className="rounded-md border border-gh-border bg-gh-canvas-inset p-3">
                <p className="text-xs text-gh-fg-muted mb-1">Skipped</p>
                <p className="text-xl font-semibold text-[#f0883e]">{teamUpdateMutation.data.summary.skipped}</p>
              </div>
              <div className="rounded-md border border-gh-border bg-gh-canvas-inset p-3">
                <p className="text-xs text-gh-fg-muted mb-1">Failed</p>
                <p className="text-xl font-semibold text-gh-danger">{teamUpdateMutation.data.summary.failed}</p>
              </div>
            </div>

            <div className="overflow-auto max-h-[360px] rounded-md border border-gh-border">
              <table className="gh-table w-full">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Status</th>
                    <th>Budget ID</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {teamResults.map((result: TeamBudgetUpdateResult) => (
                    <tr key={`${result.user}-${result.status}`}>
                      <td className="font-mono text-xs">{result.user}</td>
                      <td><ResultBadge status={result.status} /></td>
                      <td className="font-mono text-xs text-gh-fg-muted">{result.budgetId ?? '—'}</td>
                      <td className="text-xs text-gh-fg-muted">{result.message ?? 'Updated successfully'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </AppLayout>
  );
}
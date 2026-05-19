import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { SeatsFilters, ModelUsageFilters, BudgetFilters, UpdateBudgetRequest, TeamBudgetUpdateRequest, UpsertBudgetRequest } from '../types';

export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: () => api.getAppConfig(),
    staleTime: 300_000,
  });
}

export function useSummary(org?: string) {
  return useQuery({
    queryKey: ['summary', org ?? 'all'],
    queryFn: () => api.getSummary(org),
    staleTime: 60_000,
  });
}

export function useSeats(filters: SeatsFilters) {
  return useQuery({
    queryKey: ['seats', filters],
    queryFn: () => api.getSeats(filters),
    placeholderData: (prev) => prev,
  });
}

export function useEditors() {
  return useQuery({
    queryKey: ['editors'],
    queryFn: () => api.getEditors(),
    staleTime: 300_000,
  });
}

export function useOrgs() {
  return useQuery({
    queryKey: ['orgs'],
    queryFn: () => api.getOrgs(),
    staleTime: 300_000,
  });
}

export function useBudgets(filters: BudgetFilters) {
  return useQuery({
    queryKey: ['budgets', filters],
    queryFn: () => api.getBudgets(filters),
    placeholderData: (prev) => prev,
  });
}

export function useBudgetTeams(org?: string) {
  return useQuery({
    queryKey: ['budget-teams', org ?? 'none'],
    queryFn: () => api.getTeams(org!),
    enabled: Boolean(org),
    staleTime: 300_000,
  });
}

export function useTeamMembers(org?: string, teamSlug?: string) {
  return useQuery({
    queryKey: ['team-members', org ?? 'none', teamSlug ?? 'none'],
    queryFn: () => api.getTeamMembers(org!, teamSlug!),
    enabled: Boolean(org && teamSlug),
    staleTime: 300_000,
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBudgetRequest) => api.updateBudget(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useUpsertBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertBudgetRequest) => api.upsertBudget(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useTeamBudgetUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TeamBudgetUpdateRequest) => api.updateTeamBudgets(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useIngestionRuns() {
  return useQuery({
    queryKey: ['ingestion-runs'],
    queryFn: () => api.getIngestionRuns(),
    refetchInterval: 10_000,
  });
}

export function useTriggerIngestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.triggerIngestion(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['seats'] });
      qc.invalidateQueries({ queryKey: ['ingestion-runs'] });
    },
  });
}

export function useModelUsageSummary() {
  return useQuery({
    queryKey: ['model-usage-summary'],
    queryFn: () => api.getModelUsageSummary(),
    staleTime: 60_000,
  });
}

export function useModelUsageUsers(filters: ModelUsageFilters) {
  return useQuery({
    queryKey: ['model-usage-users', filters],
    queryFn: () => api.getModelUsageUsers(filters),
    placeholderData: (prev) => prev,
  });
}

export function useModelUsageModels() {
  return useQuery({
    queryKey: ['model-usage-models'],
    queryFn: () => api.getModelUsageModels(),
    staleTime: 300_000,
  });
}

export function useImportModelUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.syncModelUsage(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['model-usage-summary'] });
      qc.invalidateQueries({ queryKey: ['model-usage-users'] });
      qc.invalidateQueries({ queryKey: ['model-usage-models'] });
    },
  });
}

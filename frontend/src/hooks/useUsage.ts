import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { SeatsFilters, ModelUsageFilters } from '../types';

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

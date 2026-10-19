import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getHealth, getTelemetry, getAgents, getConnectors,
  getCurrentMode, askKhameleon, searchMemory, indexMemoryPath,
  getAgentFeed,
  type KhameleonHealth, type KhameleonConnector,
  type KhameleonTelemetry, type FeedItem,
} from '@/lib/khameleonApi';

export function useKhameleonHealth() {
  return useQuery<KhameleonHealth>({
    queryKey: ['khameleon', 'health'],
    queryFn: getHealth,
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: false,
  });
}

export function useKhameleonTelemetry() {
  return useQuery<KhameleonTelemetry>({
    queryKey: ['khameleon', 'telemetry'],
    queryFn: getTelemetry,
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: false,
  });
}

export function useKhameleonAgents() {
  return useQuery<string[]>({
    queryKey: ['khameleon', 'agents'],
    queryFn: getAgents,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useKhameleonConnectors() {
  return useQuery<KhameleonConnector[]>({
    queryKey: ['khameleon', 'connectors'],
    queryFn: getConnectors,
    staleTime: 60_000,
    retry: false,
  });
}

export function useGetCurrentMode() {
  return useQuery<{ name: string }>({
    queryKey: ['khameleon', 'mode'],
    queryFn: getCurrentMode,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useKhameleonAgentFeed() {
  return useQuery<FeedItem[]>({
    queryKey: ['khameleon', 'feed'],
    queryFn: getAgentFeed,
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: false,
  });
}

export function useAskKhameleon() {
  return useMutation({
    mutationFn: ({ prompt, agent }: { prompt: string; agent?: string }) =>
      askKhameleon(prompt, agent),
  });
}

export function useMemorySearch(q: string) {
  return useQuery({
    queryKey: ['khameleon', 'memory', q],
    queryFn: () => searchMemory(q),
    enabled: q.length > 2,
    staleTime: 30_000,
    retry: false,
  });
}

export function useIndexMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => indexMemoryPath(path),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['khameleon', 'memory'] }),
  });
}


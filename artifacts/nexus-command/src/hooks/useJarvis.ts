import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getHealth, getAgents, getConnectors, getSkills,
  askJarvis, searchMemory, indexMemoryPath, installSkill,
  type JarvisHealth, type JarvisConnector, type JarvisSkill,
} from '@/lib/jarvisApi';
import { useGetCurrentMode } from '@workspace/api-client-react';

export { useGetCurrentMode };

export function useJarvisHealth() {
  return useQuery<JarvisHealth>({
    queryKey: ['jarvis', 'health'],
    queryFn: getHealth,
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: false,
  });
}

export function useJarvisAgents() {
  return useQuery<string[]>({
    queryKey: ['jarvis', 'agents'],
    queryFn: getAgents,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useJarvisConnectors() {
  return useQuery<JarvisConnector[]>({
    queryKey: ['jarvis', 'connectors'],
    queryFn: getConnectors,
    staleTime: 60_000,
    retry: false,
  });
}

export function useJarvisSkills() {
  return useQuery<JarvisSkill[]>({
    queryKey: ['jarvis', 'skills'],
    queryFn: getSkills,
    staleTime: 60_000,
    retry: false,
  });
}

export function useAskJarvis() {
  return useMutation({
    mutationFn: ({ prompt, agent, tools }: { prompt: string; agent?: string; tools?: string[] }) =>
      askJarvis(prompt, agent, tools),
  });
}

export function useMemorySearch(q: string) {
  return useQuery({
    queryKey: ['jarvis', 'memory', q],
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jarvis', 'memory'] }),
  });
}

export function useInstallSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (source: string) => installSkill(source),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jarvis', 'skills'] }),
  });
}

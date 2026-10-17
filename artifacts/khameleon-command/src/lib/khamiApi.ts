const BASE = import.meta.env.VITE_API_URL || '/api';

/** Khami setup (server: routes/engines.ts, engines/khami.ts). */
export type BrainId = 'standard' | 'better';

export interface KhamiBrain {
  id: BrainId;
  label: string;
  description: string;
  sizeGb: number;
  minMemoryGb: number;
  modelName: string;
  downloaded: boolean;
  fitsThisComputer: boolean;
}

export interface KhamiDownload {
  state: 'idle' | 'downloading' | 'done' | 'error';
  brain?: BrainId;
  percent?: number;
  downloadedGb?: number;
  totalGb?: number;
  error?: string;
}

export interface KhamiSetup {
  memoryGb: number;
  recommended: BrainId;
  active: BrainId | null;
  brains: KhamiBrain[];
  download: KhamiDownload;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error ?? `Request failed (HTTP ${res.status})`);
  }
  return res.json();
}

export const getKhamiSetup = () => fetch(`${BASE}/engines/khami/setup`).then(r => json<KhamiSetup>(r));

export const downloadKhamiBrain = (brain: BrainId) =>
  fetch(`${BASE}/engines/khami/download`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brain }) })
    .then(r => json<KhamiDownload>(r));

export const chooseKhamiBrain = (brain: BrainId) =>
  fetch(`${BASE}/engines/khami/brain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brain }) })
    .then(r => json<KhamiSetup>(r));

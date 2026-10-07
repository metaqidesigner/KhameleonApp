/**
 * Client for importing an Integration from an external definition
 * (design-spec.md §16.6) — an OpenAPI spec or an MCP server URL — rather
 * than the first-party directory (integrationsApi.ts). Hits
 * routes/customIntegrations.ts.
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

export type CustomSourceType = 'openapi' | 'mcp';

export interface CustomIntegrationEntry {
  id: number;
  name: string;
  sourceType: CustomSourceType;
  sourceUrl: string | null;
  baseUrl: string | null;
  operationCount: number;
  enabled: boolean;
  createdAt: string;
}

export interface OperationSummary {
  toolName: string;
  method: string;
  path: string;
  summary: string;
}

export interface OpenApiPreview {
  sourceType: 'openapi';
  title: string;
  baseUrl: string;
  operations: OperationSummary[];
}

export interface McpPreview {
  sourceType: 'mcp';
  url: string;
  reachable: boolean;
  note: string;
}

export interface ImportRequest {
  sourceType: CustomSourceType;
  sourceUrl?: string;
  specText?: string;
  authToken?: string;
  name?: string;
}

async function asJson<T>(response: Response, action: string): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `${action} failed (HTTP ${response.status})`);
  }
  return response.json() as Promise<T>;
}

/** Parses the spec/server for real, but saves nothing — powers the confirm gate's "show the exact real scope" disclosure (§16.3/§16.6). */
export async function previewCustomIntegration(req: ImportRequest): Promise<OpenApiPreview | McpPreview> {
  const response = await fetch(`${BASE}/custom-integrations/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return asJson(response, 'Preview');
}

/** Re-parses and saves for real — only called after the user has reviewed the preview's real disclosure and confirmed. */
export async function importCustomIntegration(req: ImportRequest): Promise<CustomIntegrationEntry> {
  const response = await fetch(`${BASE}/custom-integrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return asJson(response, 'Import');
}

export async function getCustomIntegrations(): Promise<CustomIntegrationEntry[]> {
  try {
    const res = await fetch(`${BASE}/custom-integrations`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Always immediate and reversible, no gate (§16.5) — matches disconnectIntegration's own framing for first-party Integrations. */
export async function removeCustomIntegration(id: number): Promise<{ ok: boolean }> {
  const response = await fetch(`${BASE}/custom-integrations/${id}`, { method: 'DELETE' });
  return asJson(response, 'Disconnect');
}

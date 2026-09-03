const BASE = import.meta.env.VITE_API_URL || '/api';

export interface Approval {
  id: number;
  action: string;
  requestingAgent: string;
  reason: string;
  riskLevel: string;
  dataInvolved: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

export async function createApproval(input: {
  action: string;
  requestingAgent: string;
  reason: string;
  riskLevel: string;
  dataInvolved: string;
}): Promise<Approval> {
  const response = await fetch(`${BASE}/approvals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Approval request failed (HTTP ${response.status})`);
  }

  return response.json() as Promise<Approval>;
}
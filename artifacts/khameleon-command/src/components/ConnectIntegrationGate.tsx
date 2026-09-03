import { ConfirmGate } from './ConfirmGate';
import { connectStartPath } from '@/lib/integrationsApi';

/**
 * design-spec.md §16.3: connecting an Integration is ALWAYS a hard
 * confirm gate, "with no exceptions by task type" — full scope shown
 * before authorization, then an OAuth handoff for the credential
 * exchange itself. Before this component existed, both Settings'
 * ConnectorsSection and communications.tsx's DATA CONNECTORS panel
 * jumped straight to the OAuth redirect with no gate at all. Shared so
 * both surfaces show the exact same real scope, not two paraphrases of
 * the same disclosure that could drift apart.
 */
export function ConnectIntegrationGate({
  providerId, name, dataScope, actionScope, onCancel,
}: {
  providerId: string;
  name: string;
  dataScope: string;
  actionScope: string;
  onCancel: () => void;
}) {
  return (
    <ConfirmGate
      title={`Connect ${name}`}
      category="integration_connect"
      target={name}
      scope={`oauth:${providerId}`}
      severity="medium"
      confirmLabel="Confirm & Connect"
      payload={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div><strong>Can read:</strong> {dataScope}</div>
          <div><strong>Can do:</strong> {actionScope}</div>
        </div>
      }
      warning="You'll be sent to the provider's own sign-in page to grant access. Khameleon never sees or stores your password."
      onConfirm={() => { window.location.href = connectStartPath(providerId); }}
      onCancel={onCancel}
    />
  );
}

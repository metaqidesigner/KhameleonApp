import { useState } from 'react';
import { ConfirmGate } from './ConfirmGate';
import {
  previewCustomIntegration, importCustomIntegration,
  type CustomSourceType, type OpenApiPreview, type McpPreview,
} from '@/lib/customIntegrationsApi';

/**
 * design-spec.md §16.6 — importing an Integration from an external
 * definition (an OpenAPI spec or an MCP server URL), not the first-party
 * directory. §16.3/§16.6: connecting is always a hard confirm gate that
 * shows the exact real scope being granted, "never a paraphrase" - this
 * is why the flow has a real "Preview" step before the gate: the
 * disclosure has to come from actually parsing the spec, not from
 * whatever the user typed into the form.
 */
type Step = 'form' | 'previewing' | 'confirm' | 'importing';

export function ImportCustomIntegration({ onImported, onCancel }: { onImported: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<Step>('form');
  const [sourceType, setSourceType] = useState<CustomSourceType>('openapi');
  const [name, setName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [specText, setSpecText] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [preview, setPreview] = useState<OpenApiPreview | McpPreview | null>(null);
  const [error, setError] = useState<string>();

  const doPreview = async () => {
    setError(undefined);
    setStep('previewing');
    try {
      const result = await previewCustomIntegration({ sourceType, sourceUrl: sourceUrl.trim() || undefined, specText: specText.trim() || undefined, authToken: authToken.trim() || undefined });
      setPreview(result);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
      setStep('form');
    }
  };

  const doImport = async () => {
    setStep('importing');
    try {
      await importCustomIntegration({ sourceType, sourceUrl: sourceUrl.trim() || undefined, specText: specText.trim() || undefined, authToken: authToken.trim() || undefined, name: name.trim() });
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('confirm');
    }
  };

  if (step === 'confirm' && preview) {
    const isOpenApi = preview.sourceType === 'openapi';
    return (
      <ConfirmGate
        title={`Connect ${name || (isOpenApi ? preview.title : preview.url)}`}
        category="integration_connect"
        target={name || (isOpenApi ? preview.title : preview.url)}
        scope={isOpenApi ? `openapi:${preview.baseUrl}` : `mcp:${preview.url}`}
        severity="medium"
        confirmLabel="Confirm & Connect"
        payload={
          isOpenApi ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div><strong>Base URL:</strong> {preview.baseUrl}</div>
              <div><strong>Real operations discovered ({preview.operations.length}):</strong></div>
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {preview.operations.map((op) => (
                  <div key={op.toolName} style={{ fontSize: 11, fontFamily: 'var(--j-font-mono)', display: 'flex', gap: 8 }}>
                    <span style={{ color: op.method === 'GET' ? 'var(--j-green)' : 'var(--j-amber)', minWidth: 48 }}>{op.method}</span>
                    <span>{op.path}</span>
                    <span style={{ color: 'var(--j-text-muted)' }}>— {op.summary}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--j-text-muted)', marginTop: 4 }}>
                Only GET operations (read-only) are callable right now — write operations ({preview.operations.filter(o => o.method !== 'GET').length} discovered) require a per-action confirm gate that doesn't exist yet for imported Integrations, so they're never executed automatically.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div><strong>MCP server:</strong> {preview.url}</div>
              <div style={{ fontSize: 10, color: preview.reachable ? 'var(--j-green)' : 'var(--j-amber)' }}>
                {preview.reachable ? 'Server responded.' : "Couldn't confirm the server is reachable from here — it may still work once Claude connects to it directly."}
              </div>
              <div style={{ fontSize: 10, color: 'var(--j-text-muted)' }}>{preview.note}</div>
            </div>
          )
        }
        warning={authToken.trim() ? 'The token you entered is stored encrypted and sent only to this server when it is used.' : undefined}
        onConfirm={doImport}
        onCancel={() => setStep('form')}
      />
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ width: 460, maxWidth: '90vw', background: 'var(--j-surface)', border: '1px solid var(--j-border)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Import a custom Integration</div>
        <div style={{ fontSize: 10, color: 'var(--j-text-muted)' }}>Point Khameleon at an OpenAPI spec or an MCP server — design-spec.md §16.6.</div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button className="j-btn-ghost" style={{ flex: 1, height: 28, fontSize: 10, opacity: sourceType === 'openapi' ? 1 : 0.5 }} onClick={() => setSourceType('openapi')}>OpenAPI spec</button>
          <button className="j-btn-ghost" style={{ flex: 1, height: 28, fontSize: 10, opacity: sourceType === 'mcp' ? 1 : 0.5 }} onClick={() => setSourceType('mcp')}>MCP server</button>
        </div>

        <input className="j-input" placeholder="Name (e.g. Petstore API)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="j-input" placeholder={sourceType === 'openapi' ? 'Spec URL (https://api.example.com/openapi.json)' : 'MCP server URL (https://...)'} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        {sourceType === 'openapi' && (
          <textarea className="j-input" placeholder="...or paste the spec's JSON directly instead of a URL" value={specText} onChange={(e) => setSpecText(e.target.value)} rows={4} style={{ fontFamily: 'var(--j-font-mono)', fontSize: 10, resize: 'vertical' }} />
        )}
        <input className="j-input" placeholder="Auth token (optional - sent as a Bearer token)" value={authToken} onChange={(e) => setAuthToken(e.target.value)} type="password" />

        {error && <div style={{ fontSize: 11, color: 'var(--j-red)' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="j-btn-ghost" style={{ height: 30, padding: '0 14px', fontSize: 10 }} onClick={onCancel}>Cancel</button>
          <button
            className="j-btn-primary"
            style={{ height: 30, padding: '0 14px', fontSize: 10, opacity: step === 'previewing' ? 0.6 : 1 }}
            disabled={step === 'previewing' || !name.trim() || (!sourceUrl.trim() && !specText.trim())}
            onClick={doPreview}
          >
            {step === 'previewing' ? 'Parsing…' : 'Preview'}
          </button>
        </div>
      </div>
    </div>
  );
}

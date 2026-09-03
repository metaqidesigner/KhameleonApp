import React, { useState } from 'react';
import { AlertCircle, Check, X, Lock, Eye, EyeOff } from 'lucide-react';

/**
 * Confirm gate modal — for actions that are expensive, hard-to-reverse,
 * or affecting someone other than the user.
 *
 * Implements design-spec.md §6.5.3 (Confirm gates by reversibility)
 * and §6.5.4 (Intent preview hides nothing).
 *
 * The gate shows:
 * - The exact action being authorized
 * - The full real payload / content
 * - The exact recipient or target object
 * - The permission scope being used
 * - An editable in-place review step before approval
 * - No approve-first-edit-after (must be editable before approval)
 */

export interface ConfirmGateProps {
  /** Modal title, e.g., "Confirm send email" */
  title: string;

  /** Action category: 'email_send', 'post_public', 'submit_form', etc. */
  category: string;

  /** Recipient or target being acted upon */
  target: string;

  /** Permission scope being used (e.g., 'mail.send', 'graph.write') */
  scope: string;

  /** The full real payload/content being acted on (never summarized or redacted) */
  payload: React.ReactNode;

  /** If true, user can edit the payload before approving */
  allowEdit?: boolean;

  /** Initial payload for editing (if allowEdit is true) */
  editableContent?: string;

  /** Callback when user clicks approve/confirm */
  onConfirm: (editedContent?: string) => void | Promise<void>;

  /** Label for the final action, e.g. "Confirm & Send" or "Record Approval" */
  confirmLabel?: string;

  /** Callback when user clicks cancel */
  onCancel: () => void;

  /** Loading state for confirm button */
  confirming?: boolean;

  /** Error message from a failed confirmation attempt */
  error?: string;

  /** Severity level: 'critical' (sends mail), 'high' (posts publicly), 'medium' (modifies data) */
  severity?: 'critical' | 'high' | 'medium';

  /** Optional: detailed warning/explanation for the user */
  warning?: string;
}

/**
 * Severity color mapping (for rim glow and visual emphasis)
 */
function getSeverityColor(severity?: string): string {
  switch (severity) {
    case 'critical':
      return '#E77A7A'; // coral for email send / critical actions
    case 'high':
      return '#F0A34C'; // amber for public/external actions
    case 'medium':
      return '#8C7CF0'; // violet for internal/data changes
    default:
      return '#6FE6BD'; // teal default
  }
}

export function ConfirmGate({
  title,
  category,
  target,
  scope,
  payload,
  allowEdit = false,
  editableContent,
  onConfirm,
  confirmLabel = 'Confirm & Send',
  onCancel,
  confirming = false,
  error,
  severity = 'medium',
  warning,
}: ConfirmGateProps) {
  const [editingContent, setEditingContent] = useState(editableContent || '');
  const [isEditing, setIsEditing] = useState(allowEdit && editableContent ? false : false);
  const [payloadVisible, setPayloadVisible] = useState(true);
  const [confirming_state, setConfirming] = useState(false);

  const severityColor = getSeverityColor(severity);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(isEditing ? editingContent : undefined);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      {/* Modal body — click stops propagation */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="j-panel"
        style={{
          position: 'relative',
          width: '90%',
          maxWidth: '520px',
          maxHeight: '80vh',
          overflow: 'auto',
          '--signal-rim-glow': `0 0 24px ${severityColor}33`,
          borderColor: severityColor + '44',
        } as React.CSSProperties}
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          disabled={confirming_state}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            color: '#8fa39c',
            cursor: confirming_state ? 'wait' : 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: `1px solid ${severityColor}33`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertCircle size={18} style={{ color: severityColor, flexShrink: 0 }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '14px', fontFamily: 'var(--j-font-head)', fontWeight: 600, color: '#fff' }}>
              {title}
            </h3>
            <div style={{ fontSize: '11px', color: '#8fa39c', marginTop: '2px' }}>
              {category}
            </div>
          </div>
        </div>

        {/* Warning banner if provided */}
        {warning && (
          <div
            style={{
              margin: '12px 12px 0',
              padding: '10px 12px',
              backgroundColor: severityColor + '11',
              border: `1px solid ${severityColor}33`,
              borderRadius: '6px',
              fontSize: '11px',
              color: '#c4d4ec',
              lineHeight: 1.5,
            }}
          >
            {warning}
          </div>
        )}

        {/* Target and scope row */}
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#8fa39c', letterSpacing: '0.08em', marginBottom: '4px' }}>
              Recipient
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#c4d4ec',
                backgroundColor: 'rgba(8, 14, 32, 0.4)',
                border: '1px solid rgba(120, 168, 220, 0.10)',
                borderRadius: '6px',
                padding: '8px',
                fontFamily: 'var(--j-font-mono)',
                wordBreak: 'break-all',
              }}
            >
              {target}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#8fa39c', letterSpacing: '0.08em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={10} />
              Permission Scope
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#6FE6BD',
                backgroundColor: 'rgba(111, 230, 189, 0.08)',
                border: '1px solid rgba(111, 230, 189, 0.20)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontFamily: 'var(--j-font-mono)',
              }}
            >
              {scope}
            </div>
          </div>
        </div>

        {/* Payload section */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(120, 168, 220, 0.10)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#8fa39c', letterSpacing: '0.08em' }}>
              Content to be sent
            </div>
            {!isEditing && (
              <button
                onClick={() => setPayloadVisible(!payloadVisible)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8fa39c',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                {payloadVisible ? (
                  <>
                    <EyeOff size={12} /> Hide
                  </>
                ) : (
                  <>
                    <Eye size={12} /> Show
                  </>
                )}
              </button>
            )}
          </div>

          {isEditing ? (
            <textarea
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              style={{
                width: '100%',
                height: '140px',
                padding: '10px',
                fontSize: '11px',
                fontFamily: 'var(--j-font-mono)',
                color: '#c4d4ec',
                backgroundColor: 'rgba(8, 14, 32, 0.6)',
                border: `1px solid ${severityColor}44`,
                borderRadius: '6px',
                resize: 'vertical',
                minHeight: '80px',
              }}
            />
          ) : payloadVisible ? (
            <div
              style={{
                fontSize: '11px',
                color: '#c4d4ec',
                backgroundColor: 'rgba(8, 14, 32, 0.4)',
                border: '1px solid rgba(120, 168, 220, 0.10)',
                borderRadius: '6px',
                padding: '10px',
                fontFamily: 'var(--j-font-mono)',
                maxHeight: '180px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.4,
              }}
            >
              {payload}
            </div>
          ) : (
            <div
              style={{
                fontSize: '11px',
                color: '#586898',
                padding: '10px',
                textAlign: 'center',
                fontStyle: 'italic',
              }}
            >
              (Content hidden)
            </div>
          )}

          {allowEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              style={{
                marginTop: '8px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#6FE6BD',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Edit before sending
            </button>
          )}

          {isEditing && (
            <button
              onClick={() => setIsEditing(false)}
              style={{
                marginTop: '8px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#6FE6BD',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Done editing
            </button>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              margin: '12px',
              padding: '10px 12px',
              backgroundColor: '#E77A7A11',
              border: '1px solid #E77A7A33',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#E77A7A',
            }}
          >
            {error}
          </div>
        )}

        {/* Footer: action buttons */}
        <div
          style={{
            padding: '12px',
            borderTop: '1px solid rgba(120, 168, 220, 0.10)',
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onCancel}
            disabled={confirming_state}
            style={{
              height: '36px',
              paddingLeft: '16px',
              paddingRight: '16px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: confirming_state ? '#586898' : '#c4d4ec',
              backgroundColor: 'transparent',
              border: '1px solid rgba(120, 168, 220, 0.18)',
              borderRadius: '6px',
              cursor: confirming_state ? 'wait' : 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming_state}
            style={{
              height: '36px',
              paddingLeft: '16px',
              paddingRight: '16px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: confirming_state ? '#586898' : '#fff',
              backgroundColor: severityColor + '22',
              border: `1px solid ${severityColor}55`,
              borderRadius: '6px',
              cursor: confirming_state ? 'wait' : 'pointer',
              transition: 'background-color 0.15s, border-color 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              if (!confirming_state) {
                (e.target as HTMLButtonElement).style.backgroundColor = severityColor + '33';
                (e.target as HTMLButtonElement).style.borderColor = severityColor + '77';
              }
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = severityColor + '22';
              (e.target as HTMLButtonElement).style.borderColor = severityColor + '55';
            }}
          >
            {confirming_state ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

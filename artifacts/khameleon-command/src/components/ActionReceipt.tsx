import React, { useState } from 'react';
import { RotateCcw, CheckCircle2, AlertTriangle, Clock, Lock, Zap } from 'lucide-react';

/**
 * Action receipt — a durable, persistent record of an autonomous action.
 * Implements design-spec.md §6.5.2 (Action receipts).
 *
 * Every action shows: what changed, where, permission scope, outcome,
 * and an undo option if one exists. This is NOT a transient toast —
 * it's a permanent record in the action history (the source of truth).
 */

export interface ActionReceiptProps {
  /** Unique identifier for this action record */
  id: string;

  /** One-line plain-language description of what happened */
  description: string;

  /** Detailed explanation of the action (e.g., full email preview for sent mail) */
  detail?: React.ReactNode;

  /** Category of action: 'email_sent', 'task_created', 'draft_created', 'web_action', etc. */
  category: string;

  /** Permission scope used: 'mail.send', 'tasks.write', 'graph.write', etc. */
  scope: string;

  /** Outcome: 'success' | 'failure' | 'pending' | 'needs_review' */
  outcome: 'success' | 'failure' | 'pending' | 'needs_review';

  /** ISO timestamp when the action occurred */
  timestamp: string;

  /** Target object/record affected (e.g., "alice@example.com", "Task #42", "google.com") */
  target?: string;

  /** If true, an undo/rollback option is available */
  canUndo?: boolean;

  /** Callback when user clicks undo */
  onUndo?: () => void | Promise<void>;

  /** Loading state for undo button */
  undoLoading?: boolean;

  /** Error message if undo failed */
  undoError?: string;
}

/**
 * Outcome icon — consistent with orb/panel signal colors
 */
function OutcomeIcon({ outcome }: { outcome: string }) {
  switch (outcome) {
    case 'success':
      return <CheckCircle2 size={14} className="text-teal-400" />;
    case 'failure':
      return <AlertTriangle size={14} className="text-red-400" />;
    case 'needs_review':
      return <AlertTriangle size={14} className="text-amber-400" />;
    case 'pending':
      return <Clock size={14} className="text-violet-400" />;
    default:
      return null;
  }
}

/**
 * Action receipt card — a compact, scannable record of what the system did.
 * Serves as the durable record per spec §6.5.2: the receipt is the source
 * of truth, not a toast or a log file.
 */
export function ActionReceipt({
  id, description, detail, category, scope, outcome, timestamp,
  target, canUndo = false, onUndo, undoLoading = false, undoError,
}: ActionReceiptProps) {
  const [showDetail, setShowDetail] = useState(false);

  const handleUndo = async () => {
    if (onUndo) {
      try {
        await onUndo();
      } catch (err) {
        console.error('Undo failed:', err);
      }
    }
  };

  const timeStr = new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div
      className="j-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 14px',
        gap: '8px',
        '--signal-rim-glow': outcome === 'success'
          ? '0 0 24px rgba(111,230,189,0.16)'
          : outcome === 'failure'
          ? '0 0 24px rgba(231,122,122,0.16)'
          : outcome === 'needs_review'
          ? '0 0 24px rgba(240,163,76,0.16)'
          : '0 0 24px rgba(140,124,240,0.16)',
      } as React.CSSProperties}
    >
      {/* Header row: outcome icon, description, timestamp */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <OutcomeIcon outcome={outcome} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#c4d4ec',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {description}
            </div>
            {target && (
              <div
                style={{
                  fontSize: '11px',
                  color: '#8fa39c',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {target}
              </div>
            )}
          </div>
        </div>
        <div style={{ fontSize: '10px', color: '#586898', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {timeStr}
        </div>
      </div>

      {/* Metadata row: category badge, scope badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px' }}>
        <span
          className="j-badge-gray"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>{category}</span>
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            color: '#8fa39c',
            fontSize: '9px',
            fontFamily: 'var(--j-font-mono)',
          }}
        >
          <Lock size={8} />
          {scope}
        </span>
      </div>

      {/* Detail section (optional, expandable) */}
      {detail && (
        <div>
          {!showDetail ? (
            <button
              onClick={() => setShowDetail(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6FE6BD',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Show details
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowDetail(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6FE6BD',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  marginBottom: '6px',
                  textDecoration: 'underline',
                }}
              >
                Hide details
              </button>
              <div
                style={{
                  fontSize: '11px',
                  color: '#c4d4ec',
                  backgroundColor: 'rgba(8, 14, 32, 0.4)',
                  border: '1px solid rgba(120, 168, 220, 0.10)',
                  borderRadius: '6px',
                  padding: '8px',
                  fontFamily: 'var(--j-font-mono)',
                  maxHeight: '150px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {detail}
              </div>
            </>
          )}
        </div>
      )}

      {/* Action row: undo button if available */}
      {canUndo && (
        <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
          <button
            onClick={handleUndo}
            disabled={undoLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: undoLoading ? '#586898' : '#c4d4ec',
              background: 'none',
              border: '1px solid rgba(120, 168, 220, 0.18)',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: undoLoading ? 'wait' : 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!undoLoading) {
                (e.target as HTMLButtonElement).style.borderColor = 'rgba(111, 230, 189, 0.45)';
                (e.target as HTMLButtonElement).style.color = '#6FE6BD';
              }
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.borderColor = 'rgba(120, 168, 220, 0.18)';
              (e.target as HTMLButtonElement).style.color = '#c4d4ec';
            }}
          >
            <RotateCcw size={10} />
            Undo
          </button>
          {undoError && (
            <span style={{ fontSize: '10px', color: '#E77A7A' }}>
              {undoError}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Action receipt list — displays a column of action receipts, most recent first
 */
export function ActionReceiptList({
  receipts,
}: {
  receipts: ActionReceiptProps[];
}) {
  if (receipts.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#586898', fontSize: '12px' }}>
        No actions recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {receipts.map((receipt) => (
        <ActionReceipt key={receipt.id} {...receipt} />
      ))}
    </div>
  );
}

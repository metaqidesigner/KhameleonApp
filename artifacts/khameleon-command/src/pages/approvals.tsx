/**
 * Approvals page — Action history and confirmation patterns
 * Implements design-spec.md §6.5 (Ambient Status and Confirmation Patterns)
 */

import React, { useState } from 'react';
import { AlertCircle, Mail } from 'lucide-react';
import { ActionReceiptList, type ActionReceiptProps } from '@/components/ActionReceipt';
import { ConfirmGate } from '@/components/ConfirmGate';
import { createApproval } from '@/lib/approvalsApi';

export default function Approvals() {
  const [showConfirmGate, setShowConfirmGate] = useState(false);
  const [approvalError, setApprovalError] = useState<string>();
  const [receipts, setReceipts] = useState<ActionReceiptProps[]>([
    {
      id: 'action-1',
      description: 'Email sent to alice@example.com',
      category: 'email_sent',
      scope: 'mail.send',
      outcome: 'success' as const,
      timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
      target: 'alice@example.com',
      canUndo: true,
      detail: `Subject: Project Update\n\nHi Alice,\n\nHere's the latest project status.\nLooking forward to your thoughts.\n\nBest`,
      onUndo: async () => {
        setReceipts(r => r.filter(rc => rc.id !== 'action-1'));
      },
    },
    {
      id: 'action-2',
      description: 'Task created: Q4 planning sprint',
      category: 'task_created',
      scope: 'tasks.write',
      outcome: 'success' as const,
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      target: 'Task #42',
      canUndo: true,
      detail: `Title: Q4 planning sprint\nAssignee: You\nDue: 2026-09-17`,
      onUndo: async () => {
        console.log('Undo: delete task #42');
      },
    },
  ]);

  const handleConfirmGateConfirm = async (editedContent?: string) => {
    setApprovalError(undefined);
    await createApproval({
      action: 'email_send',
      requestingAgent: 'khameleon-demo',
      reason: 'User reviewed an email send request in the confirmation gate.',
      riskLevel: 'critical',
      dataInvolved: editedContent || 'Subject: Follow-up\n\nHi Bob,\n\nJust following up on our earlier conversation.\n\nThanks',
    }).catch((error: unknown) => {
      setApprovalError(error instanceof Error ? error.message : 'Approval request failed');
      throw error;
    });

    const newReceipt = {
      id: `action-${Date.now()}`,
      description: 'Email approved for sending (demo only)',
      category: 'email_approval',
      scope: 'mail.send',
      outcome: 'pending' as const,
      timestamp: new Date().toISOString(),
      target: 'bob@example.com',
      canUndo: false,
      detail: editedContent || `Subject: Follow-up\n\nHi Bob,\n\nJust following up on our earlier conversation.\n\nThanks`,
      onUndo: async () => {
        setReceipts(r => r.filter(rc => rc.id !== newReceipt.id));
      },
    };
    setReceipts([newReceipt, ...receipts]);
    setShowConfirmGate(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontFamily: 'var(--j-font-head)', fontWeight: 600, color: '#fff' }}>
          Approvals & Action History
        </h2>
        <p style={{ margin: 0, fontSize: '12px', color: '#8fa39c' }}>
          Durable records of autonomous actions with confirmation gates and undo options (§6.5)
        </p>
      </div>

      {/* Action button */}
      <div>
        <button
          onClick={() => setShowConfirmGate(true)}
          style={{
            height: '36px',
            paddingLeft: '16px',
            paddingRight: '16px',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#fff',
            backgroundColor: '#6FE6BD22',
            border: '1px solid rgba(111, 230, 189, 0.45)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background-color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#6FE6BD33';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#6FE6BD22';
          }}
        >
          Demo: Approve Email (no message is sent)
        </button>
      </div>

      {/* Action history */}
      <div className="j-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(120, 168, 220, 0.10)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Mail size={14} style={{ color: '#8fa39c' }} />
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#fff' }}>
            Action History
          </h3>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#586898' }}>
            {receipts.length} action{receipts.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          <ActionReceiptList receipts={receipts} />
        </div>
      </div>

      {/* Pattern explanation — height: 'auto' overrides .j-panel's height: 100%
          (index.css), which otherwise inflates this panel's flex-basis to the
          full container height and starves the Action History panel above it
          of space in the flex-column layout. This panel is a compact static
          block and should size to its own content, not fill the column. */}
      <div className="j-panel" style={{ height: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(120, 168, 220, 0.10)' }}>
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={14} style={{ color: '#F0A34C' }} />
            Patterns Implemented
          </h3>
        </div>
        <div style={{ padding: '12px 16px', fontSize: '11px', color: '#c4d4ec', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>Action receipts (§6.5.2):</strong> Every autonomous action produces a durable history entry showing what changed, where, which permission scope was used, outcome, and visible undo option.
          </p>
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>Confirm gates (§6.5.3):</strong> Expensive actions (send email, post publicly) require hard gates. Local/cheap actions get quiet receipts with undo.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Intent preview (§6.5.4):</strong> Gates show full real payload, exact recipient, permission scope, and editable-in-place review before approval. No approve-first-edit-after.
          </p>
        </div>
      </div>

      {/* ConfirmGate modal */}
      {showConfirmGate && (
        <ConfirmGate
          title="Send Email"
          category="email_send"
          target="bob@example.com"
          scope="mail.send"
          severity="critical"
          confirmLabel="Record Approval"
          error={approvalError}
          warning="This demo records your approval locally. No message is sent because the Outlook executor is not connected yet."
          payload={`Subject: Follow-up\n\nHi Bob,\n\nJust following up on our earlier conversation about the Q4 timeline. I wanted to share my thoughts on the proposed schedule.\n\nLooking forward to hearing back from you.\n\nBest regards`}
          allowEdit={true}
          editableContent={`Subject: Follow-up\n\nHi Bob,\n\nJust following up on our earlier conversation about the Q4 timeline. I wanted to share my thoughts on the proposed schedule.\n\nLooking forward to hearing back from you.\n\nBest regards`}
          onConfirm={handleConfirmGateConfirm}
          onCancel={() => setShowConfirmGate(false)}
        />
      )}
    </div>
  );
}

/**
 * Approvals page — Action history and confirmation patterns
 * Implements design-spec.md §6.5 (Ambient Status and Confirmation Patterns)
 */

import React, { useState } from 'react';
import { AlertCircle, Mail, Send, FileSearch, Inbox, RefreshCw } from 'lucide-react';
import { ActionReceiptList, type ActionReceiptProps } from '@/components/ActionReceipt';
import { ConfirmGate } from '@/components/ConfirmGate';
import { createApproval } from '@/lib/approvalsApi';
import {
  runOutlookDraftEmail, sendOutlookDraft, rejectOutlookDraft,
  runOutlookSummarizeThread,
  runOutlookTriageInbox, undoOutlookTriage,
  listOutlookMessages, type OutlookDraft, type OutlookMessagePreview,
} from '@/lib/outlookSkillsApi';

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
      // Sending mail is the canonical "hard to reverse" example in §6.5.3 -
      // an already-sent email cannot be undone, so this must never offer undo.
      canUndo: false,
      detail: `Subject: Project Update\n\nHi Alice,\n\nHere's the latest project status.\nLooking forward to your thoughts.\n\nBest`,
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

  // ── Real skill: outlook-draft-email (§12.1) ──────────────────────────────
  // Distinct from the mock demo above: this calls the actual Microsoft
  // Graph-backed pipeline (routes/outlookSkills.ts). Requires Outlook to be
  // connected (Settings → Connectors). A message id can come from the inbox
  // browser below or be typed in directly (e.g. from Graph Explorer).
  const [outlookMessageId, setOutlookMessageId] = useState('');
  const [outlookLoading, setOutlookLoading] = useState(false);
  const [outlookRunError, setOutlookRunError] = useState<string>();
  const [outlookDraft, setOutlookDraft] = useState<OutlookDraft | null>(null);
  const [outlookSending, setOutlookSending] = useState(false);
  const [outlookSendError, setOutlookSendError] = useState<string>();

  const handleRunOutlook = async (id?: string) => {
    const messageId = (id ?? outlookMessageId).trim();
    if (!messageId) return;
    setOutlookMessageId(messageId);
    setOutlookLoading(true);
    setOutlookRunError(undefined);
    try {
      const draft = await runOutlookDraftEmail(messageId);
      setOutlookDraft(draft);
    } catch (error) {
      setOutlookRunError(error instanceof Error ? error.message : 'Draft request failed');
    } finally {
      setOutlookLoading(false);
    }
  };

  const handleOutlookConfirm = async (editedContent?: string) => {
    if (!outlookDraft) return;
    setOutlookSending(true);
    setOutlookSendError(undefined);
    try {
      const { sentAt } = await sendOutlookDraft(outlookDraft.approvalId, editedContent);
      setReceipts(r => [{
        id: `outlook-${outlookDraft.approvalId}`,
        description: `Email sent to ${outlookDraft.to}`,
        category: 'email_sent',
        scope: 'mail.send',
        outcome: 'success' as const,
        timestamp: sentAt,
        target: outlookDraft.to,
        // Real send, real irreversibility — no undo offered (§6.5.3).
        canUndo: false,
        detail: `Subject: ${outlookDraft.subject}\n\n${editedContent ?? outlookDraft.body}`,
      }, ...r]);
      setOutlookDraft(null);
      setOutlookMessageId('');
    } catch (error) {
      setOutlookSendError(error instanceof Error ? error.message : 'Send failed');
      throw error; // keeps ConfirmGate open so the user can retry
    } finally {
      setOutlookSending(false);
    }
  };

  const handleOutlookCancel = () => {
    if (outlookDraft) {
      // Best-effort - closing the gate should discard the pending draft
      // rather than leave an orphaned unsent draft in the user's mailbox.
      rejectOutlookDraft(outlookDraft.approvalId).catch(() => {});
    }
    setOutlookDraft(null);
    setOutlookSendError(undefined);
  };

  // ── Real skill: outlook-summarize-thread (§12.2) ─────────────────────────
  // No ConfirmGate here, unlike outlook-draft-email above: reading and
  // summarizing is local/cheap/reversible (§6.5.3), so it's a quiet action
  // receipt, not a hard gate.
  const [summarizeMessageId, setSummarizeMessageId] = useState('');
  const [summarizeLoading, setSummarizeLoading] = useState(false);
  const [summarizeError, setSummarizeError] = useState<string>();

  const handleSummarize = async (id?: string) => {
    const messageId = (id ?? summarizeMessageId).trim();
    if (!messageId) return;
    setSummarizeMessageId(messageId);
    setSummarizeLoading(true);
    setSummarizeError(undefined);
    try {
      const result = await runOutlookSummarizeThread(messageId);
      setReceipts(r => [{
        id: `summarize-${result.taskRunId}`,
        description: `Thread summarized (${result.messageCount} message${result.messageCount !== 1 ? 's' : ''})`,
        category: 'thread_summarized',
        scope: 'mail.read',
        outcome: 'success' as const,
        timestamp: new Date().toISOString(),
        target: result.participants.join(', ') || undefined,
        canUndo: false,
        detail: result.summary,
      }, ...r]);
      setSummarizeMessageId('');
    } catch (error) {
      setSummarizeError(error instanceof Error ? error.message : 'Summarize request failed');
    } finally {
      setSummarizeLoading(false);
    }
  };

  // ── Real skill: outlook-triage-inbox (§12.3) ─────────────────────────────
  // No ConfirmGate: flagging/categorizing/archiving the user's own mail is
  // local/cheap/reversible (§6.5.3). Real undo is offered on the resulting
  // receipt instead (§6.5.2) - one receipt per run, not one per message.
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState<string>();

  const handleTriage = async () => {
    setTriageLoading(true);
    setTriageError(undefined);
    try {
      const result = await runOutlookTriageInbox();
      const receiptId = `triage-${result.taskRunId}`;
      const byLine = result.items
        .map(i => `[${i.classification}] ${i.subject} — ${i.from} (${i.actionTaken}, ${i.source})`)
        .join('\n');
      const actionItemsLine = result.actionItems.length
        ? `\n\nAction items:\n${result.actionItems.map(a => `- ${a}`).join('\n')}`
        : '';

      setReceipts(r => [{
        id: receiptId,
        description: `Triaged ${result.items.length} unread message${result.items.length !== 1 ? 's' : ''}`,
        category: 'inbox_triaged',
        scope: 'mail.readwrite',
        outcome: 'success' as const,
        timestamp: new Date().toISOString(),
        target: `${result.counts.urgent} urgent, ${result.counts.action_needed} action needed, ${result.counts.fyi} FYI, ${result.counts.low_priority} low priority`,
        canUndo: true,
        detail: `${byLine}${actionItemsLine}`,
        onUndo: async () => {
          await undoOutlookTriage(result.items.map(i => i.undo));
          setReceipts(rs => rs.filter(rc => rc.id !== receiptId));
        },
      }, ...r]);
    } catch (error) {
      setTriageError(error instanceof Error ? error.message : 'Triage request failed');
    } finally {
      setTriageLoading(false);
    }
  };

  // ── Inbox browser ─────────────────────────────────────────────────────
  // Lets a user pick a real message for outlook-draft-email/
  // outlook-summarize-thread below instead of pasting a raw Graph message
  // id found via an external tool. Loads on demand (not on page mount) so
  // opening this page doesn't silently hit Graph every time.
  const [messages, setMessages] = useState<OutlookMessagePreview[] | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string>();

  const loadMessages = async () => {
    setMessagesLoading(true);
    setMessagesError(undefined);
    try {
      setMessages(await listOutlookMessages());
    } catch (error) {
      setMessagesError(error instanceof Error ? error.message : 'Could not load inbox');
    } finally {
      setMessagesLoading(false);
    }
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

      {/* Inbox browser — feeds a message id into the two panels below */}
      <div className="j-panel" style={{ height: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(120, 168, 220, 0.10)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Inbox size={14} style={{ color: '#8fa39c' }} />
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#fff' }}>
            Inbox browser
          </h3>
          <button
            onClick={loadMessages}
            disabled={messagesLoading}
            title="Refresh"
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px',
              height: '26px', padding: '0 10px', fontSize: '10px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8fa39c',
              background: 'none', border: '1px solid rgba(120, 168, 220, 0.18)', borderRadius: '6px',
              cursor: messagesLoading ? 'wait' : 'pointer',
            }}
          >
            <RefreshCw size={11} style={messagesLoading ? { animation: 'jarvis-spin 1s linear infinite' } : undefined} />
            {messages === null ? 'Browse inbox' : 'Refresh'}
          </button>
        </div>
        <div style={{ padding: messages && messages.length > 0 ? '4px' : '12px 16px' }}>
          {messagesError && <div style={{ padding: '8px 12px', fontSize: '11px', color: '#E77A7A' }}>{messagesError}</div>}
          {messages === null && !messagesLoading && !messagesError && (
            <p style={{ margin: 0, padding: '0 12px', fontSize: '11px', color: '#8fa39c', lineHeight: 1.5 }}>
              Loads the 15 most recent messages from the connected Outlook inbox so you can pick one for the skills below, instead of pasting a raw Graph message id.
            </p>
          )}
          {messages && messages.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: '11px', color: '#8fa39c' }}>No messages found.</div>
          )}
          {messages && messages.map((m) => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
              borderBottom: '1px solid rgba(120, 168, 220, 0.06)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#c4d4ec', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.subject}
                </div>
                <div style={{ fontSize: '10px', color: '#8fa39c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.from} — {m.preview}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  onClick={() => handleSummarize(m.id)}
                  disabled={summarizeLoading}
                  style={{
                    height: '26px', padding: '0 10px', fontSize: '10px', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6FE6BD',
                    background: 'none', border: '1px solid rgba(111, 230, 189, 0.35)', borderRadius: '6px',
                    cursor: summarizeLoading ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  Summarize
                </button>
                <button
                  onClick={() => handleRunOutlook(m.id)}
                  disabled={outlookLoading}
                  style={{
                    height: '26px', padding: '0 10px', fontSize: '10px', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8C7CF0',
                    background: 'none', border: '1px solid rgba(140, 124, 240, 0.35)', borderRadius: '6px',
                    cursor: outlookLoading ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  Draft reply
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real skill: outlook-draft-email */}
      <div className="j-panel" style={{ height: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(120, 168, 220, 0.10)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Send size={14} style={{ color: '#8fa39c' }} />
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#fff' }}>
            Real skill: outlook-draft-email (§12.1)
          </h3>
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#8fa39c', lineHeight: 1.5 }}>
            Runs the real pipeline against Microsoft Graph: fetch thread → summarize → compose → create draft.
            Pick a message from the inbox browser above, or paste an id directly. Sending only happens if you confirm below.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={outlookMessageId}
              onChange={(e) => setOutlookMessageId(e.target.value)}
              placeholder="Outlook message id"
              disabled={outlookLoading}
              style={{
                flex: 1,
                height: '34px',
                padding: '0 10px',
                fontSize: '11px',
                fontFamily: 'var(--j-font-mono)',
                color: '#c4d4ec',
                backgroundColor: 'rgba(8, 14, 32, 0.4)',
                border: '1px solid rgba(120, 168, 220, 0.18)',
                borderRadius: '6px',
              }}
            />
            <button
              onClick={() => handleRunOutlook()}
              disabled={outlookLoading || !outlookMessageId.trim()}
              style={{
                height: '34px',
                padding: '0 16px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#fff',
                backgroundColor: '#8C7CF022',
                border: '1px solid rgba(140, 124, 240, 0.45)',
                borderRadius: '6px',
                cursor: outlookLoading ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {outlookLoading ? 'Drafting…' : 'Draft reply'}
            </button>
          </div>
          {outlookRunError && (
            <div style={{ fontSize: '11px', color: '#E77A7A' }}>{outlookRunError}</div>
          )}
        </div>
      </div>

      {/* Real skill: outlook-summarize-thread */}
      <div className="j-panel" style={{ height: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(120, 168, 220, 0.10)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileSearch size={14} style={{ color: '#8fa39c' }} />
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#fff' }}>
            Real skill: outlook-summarize-thread (§12.2)
          </h3>
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#8fa39c', lineHeight: 1.5 }}>
            Fetches a thread (Mail.Read) and summarizes it. Pick a message from the inbox browser above, or paste an id directly. No confirm gate — reading is local and reversible (§6.5.3) — the result lands directly as an action receipt below.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={summarizeMessageId}
              onChange={(e) => setSummarizeMessageId(e.target.value)}
              placeholder="Outlook message id"
              disabled={summarizeLoading}
              style={{
                flex: 1,
                height: '34px',
                padding: '0 10px',
                fontSize: '11px',
                fontFamily: 'var(--j-font-mono)',
                color: '#c4d4ec',
                backgroundColor: 'rgba(8, 14, 32, 0.4)',
                border: '1px solid rgba(120, 168, 220, 0.18)',
                borderRadius: '6px',
              }}
            />
            <button
              onClick={() => handleSummarize()}
              disabled={summarizeLoading || !summarizeMessageId.trim()}
              style={{
                height: '34px',
                padding: '0 16px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#fff',
                backgroundColor: '#6FE6BD22',
                border: '1px solid rgba(111, 230, 189, 0.45)',
                borderRadius: '6px',
                cursor: summarizeLoading ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {summarizeLoading ? 'Summarizing…' : 'Summarize'}
            </button>
          </div>
          {summarizeError && (
            <div style={{ fontSize: '11px', color: '#E77A7A' }}>{summarizeError}</div>
          )}
        </div>
      </div>

      {/* Real skill: outlook-triage-inbox */}
      <div className="j-panel" style={{ height: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(120, 168, 220, 0.10)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Inbox size={14} style={{ color: '#8fa39c' }} />
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#fff' }}>
            Real skill: outlook-triage-inbox (§12.3)
          </h3>
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#8fa39c', lineHeight: 1.5 }}>
            Classifies every unread message (rule-based, then judgment for anything ambiguous) and flags/categorizes/archives accordingly. No confirm gate — all reversible — but the resulting receipt offers real undo.
          </p>
          <div>
            <button
              onClick={handleTriage}
              disabled={triageLoading}
              style={{
                height: '34px',
                padding: '0 16px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#fff',
                backgroundColor: '#F0A34C22',
                border: '1px solid rgba(240, 163, 76, 0.45)',
                borderRadius: '6px',
                cursor: triageLoading ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {triageLoading ? 'Triaging…' : 'Triage inbox'}
            </button>
          </div>
          {triageError && (
            <div style={{ fontSize: '11px', color: '#E77A7A' }}>{triageError}</div>
          )}
        </div>
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

      {/* ConfirmGate modal — mock demo */}
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

      {/* ConfirmGate modal — real outlook-draft-email skill */}
      {outlookDraft && (
        <ConfirmGate
          title="Send Email"
          category="email_send"
          target={outlookDraft.to}
          scope="mail.send"
          severity="critical"
          confirmLabel="Confirm & Send"
          confirming={outlookSending}
          error={outlookSendError}
          payload={`Subject: ${outlookDraft.subject}\n\n${outlookDraft.body}`}
          allowEdit={true}
          editableContent={`Subject: ${outlookDraft.subject}\n\n${outlookDraft.body}`}
          onConfirm={handleOutlookConfirm}
          onCancel={handleOutlookCancel}
        />
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { emailBridge, type OpenEmail } from "@/lib/desktopBridge";
import { findEmail, getEmailAssistStatus, type EmailAssistStatus, type EmailRef, type FoundEmail } from "@/lib/emailAssistApi";
import { EmailCard } from "@/components/email/EmailCard";
import type { OverlayPalette } from "./palettes";

/**
 * Email assistant in the Overlay (docs/build-review.md, Build 4 answers +
 * Build 9 open-email detection). When an email is open, a card appears
 * beside its window on its own only for new mail from a real person (and
 * only when Khami is set up); otherwise a small "Help with this email"
 * button sits by the window. The email window glows light blue while it's
 * being read and white while its card is showing.
 */
const CARD_WIDTH = 320;
const GAP = 12;

const keyOf = (e: OpenEmail) => `${e.client}|${e.subject ?? ""}|${e.sender ?? ""}`;

/** New to the user: unread, or arrived in the last hour (opening an email often marks it read at once). */
function isNew(found: FoundEmail): boolean {
  if (found.unread) return true;
  const t = found.receivedAt ? Date.parse(found.receivedAt) : NaN;
  return Number.isFinite(t) && Date.now() - t < 60 * 60 * 1000;
}

export function EmailAssistant({ palette }: { palette: OverlayPalette }) {
  const bridge = emailBridge();
  const [open, setOpen] = useState<OpenEmail | null>(null);
  const [status, setStatus] = useState<EmailAssistStatus | null>(null);
  const [found, setFound] = useState<{ key: string; email: FoundEmail | null } | null>(null);
  const [card, setCard] = useState<{ key: string; ref: EmailRef; subject: string; fromName?: string } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    bridge.get().then(setOpen).catch(() => {});
    return bridge.onUpdate(setOpen);
  }, [bridge]);

  useEffect(() => {
    const load = () => getEmailAssistStatus().then(setStatus).catch(() => {});
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const key = open?.subject ? keyOf(open) : null;

  // A different email: forget the last one's card and look this one up.
  useEffect(() => {
    setNote(null);
    setCard(c => (c && c.key === key ? c : null));
    if (!open?.subject || !key || !status || (!status.outlook && !status.gmail)) { setFound(null); return; }
    let cancelled = false;
    findEmail({ client: open.client, subject: open.subject, sender: open.sender })
      .then(email => { if (!cancelled) setFound({ key, email }); })
      .catch(() => { if (!cancelled) setFound({ key, email: null }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, status?.outlook, status?.gmail]);

  // Cards open on their own only for new mail from a real person, with Khami ready.
  useEffect(() => {
    const email = found?.key === key ? found.email : null;
    if (!key || !email || !status?.khami || dismissed.has(key) || card?.key === key) return;
    if (email.isPerson && isNew(email)) {
      setCard({ key, ref: { source: email.source, id: email.id }, subject: email.subject, fromName: email.fromName || undefined });
    }
  }, [found, key, status?.khami, dismissed, card?.key]);

  // The email window's glow follows the card.
  useEffect(() => {
    if (!bridge) return;
    void bridge.setGlow(card ? (reading ? "reading" : "visible") : null);
  }, [bridge, card, reading]);

  const ref = useMemo(() => card?.ref, [card]);
  if (!bridge || !open?.subject || !key) return null;

  const helpNow = async () => {
    setNote(null);
    const email = found?.key === key ? found.email : null;
    if (email) { setCard({ key, ref: { source: email.source, id: email.id }, subject: email.subject, fromName: email.fromName || undefined }); return; }
    const text = await bridge.readOpenEmail().catch(() => null);
    if (text?.body) { setCard({ key, ref: { email: text }, subject: text.subject, fromName: text.from.replace(/\s*<[^>]+>\s*$/, "") || undefined }); return; }
    setNote("Khameleon can't read this email yet - connect Outlook or Gmail from Integrations.");
  };

  // Beside the email window: right if there's room, else left, else just inside its right edge.
  const b = open.bounds;
  const vw = window.innerWidth, vh = window.innerHeight;
  const left = b.x + b.width + GAP + CARD_WIDTH <= vw - 8 ? b.x + b.width + GAP
    : b.x - GAP - CARD_WIDTH >= 8 ? b.x - GAP - CARD_WIDTH
    : Math.max(8, Math.min(vw - CARD_WIDTH - 8, b.x + b.width - CARD_WIDTH - GAP));
  const top = Math.max(12, Math.min(vh - 120, b.y + 36));

  if (card && ref) {
    return (
      <div data-overlay-hit style={{ position: "fixed", left, top, zIndex: 55 }}>
        <EmailCard tone="overlay" emailRef={ref} subject={card.subject} fromName={card.fromName} copilotAvailable={!!status?.copilot}
          onReadingChange={setReading}
          onClose={() => { setDismissed(d => new Set(d).add(card.key)); setCard(null); setReading(false); }}
          style={{ maxHeight: `calc(100vh - ${top + 16}px)` }} />
      </div>
    );
  }

  return (
    <div data-overlay-hit style={{ position: "fixed", left, top, zIndex: 55, display: "flex", flexDirection: "column", gap: 6, maxWidth: CARD_WIDTH }}>
      <button type="button" onClick={() => void helpNow()} style={{
        alignSelf: left > b.x ? "flex-start" : "flex-end", display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px", borderRadius: 999, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
        background: palette.glass, border: `1px solid ${palette.glassBorder}`, color: palette.text,
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: palette.glassShadow,
      }}>
        <Mail size={13} color={palette.accent} /> Help with this email
      </button>
      {note && <div role="status" style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 10, background: palette.glass, color: palette.text, border: `1px solid ${palette.glassBorder}` }}>{note}</div>}
    </div>
  );
}

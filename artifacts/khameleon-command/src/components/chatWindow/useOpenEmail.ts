import { useEffect, useState } from 'react';
import { emailBridge } from '@/lib/desktopBridge';
import { findEmail, type FoundEmail } from '@/lib/emailAssistApi';

/**
 * Build 9 (docs/build-review.md): which email is open right now - from the
 * desktop app (window title, or the Mac mail app's selection) looked up
 * through the Outlook/Gmail connection. Null when it can't tell; the cards
 * then show the recent-messages picker. Never acts by itself: cards name
 * the email ("Replying to: …") and wait for the user.
 */
export function useOpenEmail(): { email: FoundEmail | null; looking: boolean } {
  const [email, setEmail] = useState<FoundEmail | null>(null);
  const [looking, setLooking] = useState(true);
  useEffect(() => {
    const bridge = emailBridge();
    if (!bridge) { setLooking(false); return; }
    let cancelled = false;
    bridge.get()
      .then(open => (open?.subject ? findEmail({ client: open.client, subject: open.subject, sender: open.sender }) : null))
      .then(found => { if (!cancelled) setEmail(found ?? null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLooking(false); });
    return () => { cancelled = true; };
  }, []);
  return { email, looking };
}

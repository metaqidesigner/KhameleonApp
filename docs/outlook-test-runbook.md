# Testing the Outlook skills against a real mailbox

Kept from the original setup notes. Do this once a Microsoft app registration exists (Settings → Microsoft sign-in).

Built 2026-09-03, never run end-to-end — this sandbox has no live network or a Microsoft app registration. Do this once real credentials exist:

1. Register an app at [entra.microsoft.com](https://entra.microsoft.com) (App registrations), add a web redirect URI matching this deployment's `/api/auth/oauth/microsoft/callback`, and grant delegated `Mail.ReadWrite` + `Mail.Send` + `User.Read`. Enter its details in Settings → Microsoft sign-in (or set `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET`).
2. Visit `/api/auth/oauth/microsoft/start`, sign in, confirm `GET /api/connectors` now shows `outlook: connected: true`.
3. Get a real message id: `GET https://graph.microsoft.com/v1.0/me/messages?$top=1` in [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer) (signed in as the same account) — copy its `id`.
4. On the Approvals page, run each skill against that id / the connected inbox in this order:
   - **outlook-summarize-thread** first — pure read, safest, confirms the Graph connection and thread-fetch logic work before anything writes.
   - **outlook-draft-email** next — confirms it creates a real (unsent) draft; check it actually appears in Drafts before ever clicking Confirm & Send in ConfirmGate.
   - **outlook-triage-inbox** last, and only against a mailbox you don't mind being reorganized — it flags/categorizes/archives every real unread message. Test the Undo button immediately after and confirm messages actually reappear in Inbox with prior categories/flags restored.
5. Watch specifically for the id-reassignment behavior `moveMessage` depends on (see the Gotchas in README.md) — it's documented from Graph's own reference docs, not observed firsthand.


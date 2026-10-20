/**
 * The pages shown in the person's web browser at the end of Khameleon's
 * built-in Microsoft sign-in (download decisions, step 3): signed in, a
 * problem, or "your company needs to approve Khameleon once" with Send to IT
 * - an email with the one approval link and a short plain-English sheet
 * (docs/it-approval-sheet.md has the full version). Pure.
 */

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} - Khameleon</title>
<style>
  :root { color-scheme: light dark; --bg:#f4f8f8; --card:#fff; --text:#12262a; --muted:#4d6a6e; --accent:#1f9e7a; --line:#d5e4e4; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0a161a; --card:#10232a; --text:#d6efee; --muted:#8fb4b6; --accent:#6fe6bd; --line:#1f3a40; } }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg); color:var(--text); font:15px/1.55 -apple-system, "Segoe UI", system-ui, sans-serif; padding:16px; box-sizing:border-box; }
  main { max-width:520px; width:100%; background:var(--card); border:1px solid var(--line); border-radius:16px; padding:28px; box-sizing:border-box; }
  h1 { font-size:21px; line-height:1.3; margin:0 0 10px; text-wrap:balance; }
  p { margin:0 0 12px; color:var(--muted); }
  .row { display:flex; gap:10px; flex-wrap:wrap; margin-top:16px; }
  a.btn, button { display:inline-block; padding:9px 16px; border-radius:10px; border:1px solid var(--accent); background:transparent; color:var(--text); font:inherit; text-decoration:none; cursor:pointer; }
  a.btn.primary { background:var(--accent); color:#06231b; font-weight:600; }
  textarea { width:100%; box-sizing:border-box; min-height:180px; margin-top:12px; padding:10px; border-radius:10px; border:1px solid var(--line); background:transparent; color:var(--text); font:13px/1.5 ui-monospace, monospace; }
  a:focus-visible, button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
</style></head><body><main>${body}</main></body></html>`;
}

export function signedInPage(what: "Microsoft" | "Copilot"): string {
  return page("Signed in", `<h1>You're signed in${what === "Copilot" ? " to Copilot" : " with Microsoft"}.</h1>
<p>You can close this tab and go back to Khameleon. You won't need to sign in again.</p>`);
}

export function signInProblemPage(reason: string): string {
  return page("Sign-in didn't finish", `<h1>The sign-in didn't finish.</h1><p>${esc(reason)}</p>
<p>Close this tab and choose <b>Sign in with Microsoft</b> in Khameleon to try again.</p>`);
}

/** The email to IT: the approval link and the essentials, in plain English. Pure. */
export function itRequestEmail(approvalUrl: string, copilot = false): { subject: string; body: string } {
  return {
    subject: copilot ? "Please approve Khameleon to use Microsoft 365 Copilot" : "Please approve Khameleon for Microsoft 365 sign-in",
    body: [
      "Hi,",
      "",
      copilot
        ? "I'd like Khameleon (a desktop work assistant) to use our Microsoft 365 Copilot. Microsoft requires an administrator to approve this once - after that, everyone here with a Copilot licence can turn it on themselves."
        : "I'd like to use Khameleon, a desktop work assistant, with my work Microsoft 365 account. Our settings need an administrator to approve it once - after that, everyone here can sign in without asking again.",
      "",
      "Approve it here (sign in as a Microsoft 365 administrator, check what it asks for, choose Accept):",
      approvalUrl,
      "",
      "About Khameleon:",
      copilot
        ? "- What it asks for: the read permissions Microsoft's Copilot Chat API requires, so Copilot can answer with the person's work information. It does not ask to send email."
        : "- What it asks for: read and organise email, save draft replies, read and update the calendar, and basic profile. It does NOT ask to send email - people send drafts themselves in Outlook.",
      "- Where data goes: Khameleon runs on the person's own computer, and so does its own AI. Nothing is sent to Khameleon's makers - there are no Khameleon servers. Outside AI services are only used if our organisation switches them on, and never for work Khameleon identifies as confidential.",
      "- Sign-in: standard Microsoft sign-in (OAuth 2.0 with PKCE). It's kept encrypted on the person's computer. Anyone can disconnect in Khameleon; admins can remove it any time in Microsoft Entra > Enterprise applications.",
      "",
      "After approving, Microsoft may show a \"can't connect to localhost\" page - that's expected and can be closed.",
      "",
      "Thanks",
    ].join("\n"),
  };
}

export function needsItPage(approvalUrl: string, copilot = false): string {
  const { subject, body } = itRequestEmail(approvalUrl, copilot);
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return page("Your company needs to approve Khameleon", `<h1>Your company needs to approve Khameleon once.</h1>
<p>Your organisation asks its IT team to approve new apps that use Microsoft 365. It takes them about a minute, and once it's approved, <b>everyone at your organisation</b> can sign in without asking again.</p>
<p>Send them the request below - it has the approval link and a short explanation of what Khameleon does.</p>
<div class="row"><a class="btn primary" href="${esc(mailto)}">Email your IT team</a><button type="button" id="copy">Copy the request</button></div>
<textarea id="req" readonly aria-label="The request for your IT team">${esc(`${subject}\n\n${body}`)}</textarea>
<p style="margin-top:12px">When IT says it's done, choose <b>Sign in with Microsoft</b> in Khameleon again.</p>
<script>document.getElementById("copy").onclick=function(){var t=document.getElementById("req");t.select();navigator.clipboard?navigator.clipboard.writeText(t.value):document.execCommand("copy");this.textContent="Copied";};</script>`);
}

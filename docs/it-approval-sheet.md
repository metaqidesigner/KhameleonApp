# Khameleon - a one-page guide for IT teams

Khameleon is a desktop work assistant. People install it on their own computer and sign in with their work Microsoft 365 account once. If your organisation asks IT to approve new apps, this page explains what you're approving.

## What Khameleon asks Microsoft for

**Signing in (most people can approve this themselves):**

| Permission | Why |
|---|---|
| Sign in and read basic profile (`openid`, `profile`, `User.Read`) | To know who's signed in |
| Read and write mail (`Mail.ReadWrite`) | Summarise emails, sort the inbox (with undo), save draft replies |
| Read and write calendars (`Calendars.ReadWrite`) | Meeting briefs, adding tasks with dates |
| Stay signed in (`offline_access`) | So people sign in once, not every day |

**Khameleon does not ask to send email.** Replies are saved in the person's Drafts; they send them from Outlook themselves.

**Microsoft 365 Copilot (optional, needs admin approval):** the read permissions Microsoft's Copilot Chat API requires (`Sites.Read.All`, `Mail.Read`, `People.Read.All`, `OnlineMeetingTranscript.Read.All`, `Chat.Read`, `ChannelMessage.Read.All`, `ExternalItem.Read.All`). Only people with a Copilot licence can use it.

## Where data goes

- **Khameleon runs on the person's computer.** Its data (chats, tasks, recordings, saved logins) is stored there, encrypted where sensitive, with the key held by the computer's own keychain.
- **Its AI, Khami, runs on the computer too.**
- **Nothing is sent to Khameleon's makers. There are no Khameleon servers.**
- **Outside AI services** (Copilot, Azure OpenAI and others) are used only if your organisation switches them on, and never for work Khameleon identifies as confidential.

## Sign-in security

- Standard Microsoft sign-in: OAuth 2.0 authorisation code flow with PKCE. Khameleon is a public client, so there's no app secret to leak.
- Tokens are stored encrypted on the person's computer and renewed in the background.
- People can disconnect any time in Khameleon. Admins can remove Khameleon for everyone in **Microsoft Entra admin centre → Enterprise applications → Khameleon**, or review sign-ins there.

## Approving it

Use the approval link in the request you received, sign in as an administrator, review the permissions and choose **Accept**. That approves it for everyone in your organisation. Microsoft may then show a "can't connect to localhost" page. That's expected and you can close it.

Questions: [COMPANY CONTACT EMAIL]

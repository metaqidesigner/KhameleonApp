# Security review - 2026-10-20 (pre-launch step A3)

Scope: everything added since the earlier reviews - the desktop link and pairing, saved logins, the input recorder and replay, automatic detection, the confidential lock - plus how the server and desktop windows can be reached. Findings in plain words, most serious first.

| # | Finding | Risk | Fixed |
|---|---|---|---|
| 1 | The server listened on the whole network, and with no password (the default) anyone on the same network could use it - read saved logins, use the chat, drive the desktop through the desktop tools. | High | Listens on this computer only by default (`KHAMELEON_HOST`); without a password or accounts, requests from other computers are refused (`KHAMELEON_ALLOW_NO_PASSWORD=true` to opt out). Verified: the network address is refused. |
| 2 | Any website could call the server from the user's browser (CORS allowed every site), e.g. to read data or start actions. | High | Only Khameleon's own pages may call it; other sites' changes are refused and their reads get no permission. Verified with a fake website origin. |
| 3 | DNS rebinding: a web page could make the browser reach the local server under its own name. | Medium | Local installs only accept requests addressed to `localhost`. Verified. |
| 4 | Khameleon's desktop windows (which hold the pairing code, Capture, the open email) would load any page they were sent to - a website opened inside one could pose as the desktop app and receive saved-login passwords. | High | Windows only load Khameleon's own pages; links and sign-in pages open in the normal browser. |
| 5 | Capture recordings kept exactly what was typed, stored as plain text with the skill (passwords were already excluded). | Medium | Typed text that looks confidential (bank, card, NI numbers, pay, health…) isn't kept; replay stops there and asks the user to type it. |
| 6 | Wording said Khami works "on this computer" even when an organisation runs Khami on its own server. | Low (honesty) | Wording now says "on your organisation's Khameleon server" in that case. Desktop-only work (detection log, Capture snapshots, typing logins) still says "on this computer" - which is true. |
| 7 | The "allow Khameleon to work in [app]?" prompt shows the app's name in a window with extra powers. | Low | Already escaped; now escapes quotes and `>` as well. |

Checked and fine: saved-login passwords never reach the AI (not in tool inputs/results; typed natively; Windows uses standard input); the pairing code is stored hashed and compared in constant time; detection data stays in a private file (readable only by the user) and is pruned; content watching is judged by Khami only; Microsoft and Azure secrets are stored encrypted and never sent back; uploaded documents are read by type, with size limits; sign-in return addresses are restricted (earlier fix).

Known limits, by design: with a password but no accounts, everyone who knows it shares the same data (see SELF_HOSTING.md); whoever controls the server can direct the paired desktop app; the encryption key is a server setting, not a secrets vault (deferred-gap decision pending).

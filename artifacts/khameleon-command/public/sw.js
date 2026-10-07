// Mobile Morning Briefing PWA service worker — installability only.
// Deliberately does NOT cache the briefing itself: the briefing is live,
// real-time data (tasks, drafted replies, inbox triage), and a stale
// cached version would be actively wrong, not a reasonable offline
// fallback. This worker exists only so the browser considers the app
// installable (a real requirement, not a formality) — it passes every
// fetch straight through to the network.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

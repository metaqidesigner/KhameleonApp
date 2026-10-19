/**
 * Automatic task detection, layer 1 (docs/build-review.md, Build 6): spot a
 * work task the user repeats, from a private log of app/window switches only
 * (no typing, no snapshots, no clicks). Pure functions - the desktop app keeps
 * the log and asks these whether a pattern has recurred.
 *
 * A repeat = the same sequence of 3+ steps on at least 3 different days within
 * 2 weeks. Window names are compared by their meaningful words, so
 * "Acme statement Sep.pdf" and "Beta statement Oct.pdf" count as the same step.
 */

export interface SwitchEntry { at: number; app: string; title: string }
export interface StepKey { app: string; words: string[] }
export interface Pattern { id: string; steps: StepKey[]; days: string[]; lastSeen: number; example: SwitchEntry[] }

const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/;
const NOISE = new Set(["the", "and", "for", "with", "from", "your", "you", "new", "untitled", "copy", "draft", "final", "edited", "document", "page", "tab", "window", "home", "inbox", "pdf", "xlsx", "docx", "csv", "txt", "png", "jpg", "google", "chrome", "safari", "microsoft", "edge", "firefox", "outlook", "excel", "word", "mail", "message", "html"]);

/** The meaningful words of a window name (no numbers, dates or file details). Pure. */
export function titleWords(title: string): string[] {
  const words = (title || "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/)
    .filter(w => w.length >= 3 && !MONTHS.test(w) && !NOISE.has(w));
  return [...new Set(words)].slice(0, 6);
}

export function stepKey(e: SwitchEntry): StepKey {
  return { app: e.app, words: titleWords(e.title) };
}

/** Same step: same app, and window names sharing enough meaningful words. Pure. */
export function sameStep(a: StepKey, b: StepKey): boolean {
  if (a.app !== b.app) return false;
  if (!a.words.length && !b.words.length) return true;
  if (!a.words.length || !b.words.length) return false;
  const B = new Set(b.words);
  const shared = a.words.filter(w => B.has(w)).length;
  // Measured against the shorter name: "acme statement" and "beta statement" share half.
  return shared / Math.min(a.words.length, b.words.length) >= 0.5;
}

// ── Leaving things out ─────────────────────────────────────────────────────

const DEFAULT_EXCLUDED = /\b(bank|banking|online banking|paypal|revolut|monzo|starling|wise\.com|barclays|hsbc|natwest|lloyds|santander|nationwide|halifax|chase|wells fargo|commbank|commonwealth bank|westpac|anz|nab|1password|bitwarden|lastpass|keeper|dashlane|keychain access|passwords|private browsing|incognito|inprivate)\b/i;

/** Should this window never be logged? Default list (switchable) plus the user's own words. Pure. */
export function isExcluded(app: string, title: string, opts: { defaults: boolean; custom: string[] }): boolean {
  const text = `${app} ${title}`;
  if (opts.defaults && DEFAULT_EXCLUDED.test(text)) return true;
  return opts.custom.some(c => c.trim() && text.toLowerCase().includes(c.trim().toLowerCase()));
}

// ── Finding repeats ────────────────────────────────────────────────────────

const dayOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Working sessions: switches split where there's a long gap, repeated steps collapsed. Pure. */
export function sessions(entries: SwitchEntry[], gapMs = 10 * 60_000): SwitchEntry[][] {
  const out: SwitchEntry[][] = [];
  let cur: SwitchEntry[] = [];
  const sorted = [...entries].sort((a, b) => a.at - b.at);
  for (const e of sorted) {
    const prev = cur[cur.length - 1];
    if (prev && (e.at - prev.at > gapMs || dayOf(e.at) !== dayOf(prev.at))) { out.push(cur); cur = []; }
    const last = cur[cur.length - 1];
    if (last && sameStep(stepKey(last), stepKey(e))) continue;
    cur.push(e);
  }
  if (cur.length) out.push(cur);
  return out;
}

function containsRun(session: SwitchEntry[], run: StepKey[]): boolean {
  const keys = session.map(stepKey);
  outer: for (let i = 0; i + run.length <= keys.length; i++) {
    for (let j = 0; j < run.length; j++) if (!sameStep(keys[i + j], run[j])) continue outer;
    return true;
  }
  return false;
}

export function patternId(steps: StepKey[]): string {
  return steps.map(s => `${s.app.toLowerCase()}:${[...s.words].sort().join("+")}`).join(">");
}

/**
 * Sequences of `minLen`+ steps found on `minDays`+ different days within the
 * last `windowDays` - longest first, without patterns already inside a longer
 * one. Single-app sequences are ignored (that's just using one app). Pure.
 */
export function findRepeats(entries: SwitchEntry[], now = Date.now(), opts: { minLen?: number; maxLen?: number; minDays?: number; windowDays?: number } = {}): Pattern[] {
  const minLen = opts.minLen ?? 3, maxLen = opts.maxLen ?? 6, minDays = opts.minDays ?? 3, windowDays = opts.windowDays ?? 14;
  const recent = entries.filter(e => now - e.at <= windowDays * 86_400_000 && e.at <= now);
  const all = sessions(recent);
  const found: Pattern[] = [];
  const seen = new Set<string>();
  for (const s of [...all].reverse()) {
    for (let len = Math.min(maxLen, s.length); len >= minLen; len--) {
      for (let i = 0; i + len <= s.length; i++) {
        const example = s.slice(i, i + len);
        const run = example.map(stepKey);
        if (new Set(run.map(r => r.app)).size < 2) continue;
        const id = patternId(run);
        if (seen.has(id)) continue;
        seen.add(id);
        const days = [...new Set(all.filter(x => containsRun(x, run)).map(x => dayOf(x[0].at)))];
        if (days.length < minDays) continue;
        if (found.some(f => f.steps.length > len && containsRun(f.example, run))) continue;
        found.push({ id, steps: run, days: days.sort(), lastSeen: Math.max(...example.map(e => e.at)), example });
      }
    }
  }
  return found.sort((a, b) => b.steps.length - a.steps.length || b.days.length - a.days.length);
}

/** "Outlook → Acme statement (PDF) → Excel" - for the offer. Pure. */
export function describePattern(p: Pattern): string {
  return p.example.map(e => {
    const t = e.title.replace(/\s*[-—–]\s*(Google Chrome|Safari|Microsoft Edge|Firefox)$/i, "").trim();
    return t && t !== e.app ? `${e.app} (${t.slice(0, 40)})` : e.app;
  }).join(" → ");
}

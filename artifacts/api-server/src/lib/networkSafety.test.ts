import { test } from "node:test";
import assert from "node:assert/strict";
import { isLoopback, originAllowed, originGuard, hostGuard } from "./networkSafety.js";

const allowed = new Set(["http://localhost:5173"]);

test("this computer vs others", () => {
  assert.ok(isLoopback("127.0.0.1"));
  assert.ok(isLoopback("::1"));
  assert.ok(isLoopback("::ffff:127.0.0.1"));
  assert.ok(!isLoopback("192.168.1.20"));
  assert.ok(!isLoopback(undefined));
});

test("only Khameleon's own pages count as allowed origins", () => {
  assert.ok(originAllowed("http://localhost:5173", "localhost:4001", allowed));
  assert.ok(originAllowed("https://khameleon.acme.co.uk", "khameleon.acme.co.uk", allowed), "same site as the server");
  assert.ok(!originAllowed("https://evil.example.com", "localhost:4001", allowed));
});

function run(mw: typeof originGuard, req: { method: string; headers: Record<string, string> }) {
  let status = 200, nextCalled = false;
  const headers: Record<string, string> = {};
  const res = { setHeader: (k: string, v: string) => { headers[k] = v; }, status: (s: number) => { status = s; return res; }, json: () => res, end: () => res } as never;
  mw({ method: req.method, get: (h: string) => req.headers[h.toLowerCase()], socket: {} } as never, res, () => { nextCalled = true; });
  return { status, nextCalled, headers };
}

test("other websites can't change things or read answers", () => {
  const evilPost = run(originGuard, { method: "POST", headers: { origin: "https://evil.example.com", host: "localhost:4001" } });
  assert.equal(evilPost.status, 403);
  assert.equal(evilPost.nextCalled, false);
  const evilGet = run(originGuard, { method: "GET", headers: { origin: "https://evil.example.com", host: "localhost:4001" } });
  assert.equal(evilGet.nextCalled, true);
  assert.equal(evilGet.headers["Access-Control-Allow-Origin"], undefined, "the other site may not read it");
  const ok = run(originGuard, { method: "POST", headers: { origin: "http://localhost:5173", host: "localhost:4001" } });
  assert.equal(ok.nextCalled, true);
  assert.equal(ok.headers["Access-Control-Allow-Origin"], "http://localhost:5173");
  assert.equal(run(originGuard, { method: "POST", headers: { host: "localhost:4001" } }).nextCalled, true, "no Origin: the desktop app or a script");
});

test("when local-only, requests must be addressed to localhost (blocks DNS rebinding)", () => {
  delete process.env.KHAMELEON_HOST;
  assert.equal(run(hostGuard, { method: "GET", headers: { host: "localhost:4001" } }).nextCalled, true);
  assert.equal(run(hostGuard, { method: "GET", headers: { host: "127.0.0.1:4001" } }).nextCalled, true);
  assert.equal(run(hostGuard, { method: "GET", headers: { host: "evil.example.com:4001" } }).status, 421);
  process.env.KHAMELEON_HOST = "0.0.0.0";
  assert.equal(run(hostGuard, { method: "GET", headers: { host: "khameleon.acme.co.uk" } }).nextCalled, true);
  delete process.env.KHAMELEON_HOST;
});

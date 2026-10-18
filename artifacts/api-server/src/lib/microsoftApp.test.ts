import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMicrosoftAppInput, testMicrosoftApp } from "./microsoftApp.js";

const ID = "1a2b3c4d-1234-5678-9abc-1234567890ab";

test("checks the Microsoft app details before saving, in plain words", () => {
  assert.equal(checkMicrosoftAppInput({ clientId: ID, clientSecret: "abc~defghijkl" }), null);
  assert.equal(checkMicrosoftAppInput({ clientId: ID, clientSecret: "abc~defghijkl", tenantId: "" }), null);
  assert.match(checkMicrosoftAppInput({ clientId: "khameleon", clientSecret: "abc~defghijkl" })!, /Application \(client\) ID/);
  assert.match(checkMicrosoftAppInput({ clientId: ID, clientSecret: "short" })!, /secret's Value/);
  assert.match(checkMicrosoftAppInput({ clientId: ID, clientSecret: "abc~defghijkl", tenantId: "acme" })!, /Directory \(tenant\) ID/);
});

test("Test asks Microsoft when a Directory ID is given, and explains what's wrong", async () => {
  const app = { clientId: ID, clientSecret: "abc~defghijkl", tenantId: ID, source: "settings" as const };
  const ok = await testMicrosoftApp(app, async () => new Response("{}", { status: 200 }));
  assert.equal(ok.ok, true);
  const badSecret = await testMicrosoftApp(app, async () => new Response(JSON.stringify({ error: "invalid_client", error_codes: [7000215] }), { status: 401 }));
  assert.equal(badSecret.ok, false);
  assert.match(badSecret.message, /secret is wrong or has expired/);
  let called = false;
  const noTenant = await testMicrosoftApp({ ...app, tenantId: undefined }, async () => { called = true; return new Response("{}"); });
  assert.equal(called, false);
  assert.match(noTenant.message, /first sign-in will confirm/);
});

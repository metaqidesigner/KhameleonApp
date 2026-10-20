import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMicrosoftAppInput, testMicrosoftApp, secretParams, OUTLOOK_SCOPES, adminApprovalUrl, needsAdminApproval } from "./microsoftApp.js";
import { itRequestEmail } from "./signInPages.js";

const ID = "1a2b3c4d-1234-5678-9abc-1234567890ab";

test("checks the Microsoft app details before saving, in plain words", () => {
  assert.equal(checkMicrosoftAppInput({ clientId: ID, clientSecret: "abc~defghijkl" }), null);
  assert.equal(checkMicrosoftAppInput({ clientId: ID, clientSecret: "abc~defghijkl", tenantId: "" }), null);
  assert.match(checkMicrosoftAppInput({ clientId: "khameleon", clientSecret: "abc~defghijkl" })!, /Application \(client\) ID/);
  assert.match(checkMicrosoftAppInput({ clientId: ID, clientSecret: "short" })!, /secret's Value/);
  assert.match(checkMicrosoftAppInput({ clientId: ID, clientSecret: "abc~defghijkl", tenantId: "acme" })!, /Directory \(tenant\) ID/);
});

test("Test asks Microsoft when a Directory ID is given, and explains what's wrong", async () => {
  const app = { clientId: ID, clientSecret: "abc~defghijkl", tenantId: ID, source: "settings" as const, public: false };
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

test("Khameleon's built-in sign-in: no secret, never asks to send email, one IT approval link", async () => {
  const builtIn = { clientId: ID, source: "built-in" as const, public: true };
  assert.deepEqual(secretParams(builtIn), {});
  assert.deepEqual(secretParams({ clientId: ID, clientSecret: "abc~defghijkl", source: "settings", public: false }), { client_secret: "abc~defghijkl" });
  assert.equal(OUTLOOK_SCOPES.some(s => /Mail\.Send/i.test(s)), false);
  assert.ok(OUTLOOK_SCOPES.includes("offline_access"), "signed in once, renewed quietly");
  const url = new URL(adminApprovalUrl(ID));
  assert.equal(url.pathname, "/organizations/v2.0/adminconsent");
  assert.equal(url.searchParams.get("client_id"), ID);
  assert.match(url.searchParams.get("scope")!, /Mail\.ReadWrite/);
  assert.doesNotMatch(url.searchParams.get("scope")!, /offline_access|Mail\.Send/);
  assert.equal((await testMicrosoftApp(builtIn)).ok, true);
});

test("spots Microsoft's 'your company needs to approve this' answers", () => {
  assert.equal(needsAdminApproval("access_denied", "AADSTS90094: The grant requires admin permission."), true);
  assert.equal(needsAdminApproval("invalid_request", "AADSTS65001: The user or administrator has not consented"), true);
  assert.equal(needsAdminApproval("access_denied", "AADSTS65004: User declined to consent to access the app."), false);
  assert.equal(needsAdminApproval("access_denied", undefined), false);
});

test("the email to IT has the approval link and says Khameleon doesn't send email", () => {
  const { subject, body } = itRequestEmail("https://login.microsoftonline.com/organizations/v2.0/adminconsent?client_id=x");
  assert.match(subject, /approve Khameleon/);
  assert.match(body, /adminconsent\?client_id=x/);
  assert.match(body, /does NOT ask to send email/);
  assert.match(body, /no Khameleon servers/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAzureInput, azureErrorText } from "./azureOpenAI.js";

const KEY = "0123456789abcdef0123456789abcdef";

test("checks the Azure details before saving, in plain words", () => {
  assert.deepEqual(checkAzureInput({ endpoint: "https://acme-ai.openai.azure.com/", deployment: "gpt-4o", apiKey: KEY }), { problem: null, endpoint: "https://acme-ai.openai.azure.com" });
  assert.equal(checkAzureInput({ endpoint: "https://acme.services.ai.azure.com", deployment: "gpt-4o-mini", apiKey: KEY }).problem, null);
  assert.match(checkAzureInput({ endpoint: "https://evil.example.com", deployment: "gpt-4o", apiKey: KEY }).problem!, /your-resource\.openai\.azure\.com/);
  assert.match(checkAzureInput({ endpoint: "acme", deployment: "gpt-4o", apiKey: KEY }).problem!, /resource address/);
  assert.match(checkAzureInput({ endpoint: "https://acme-ai.openai.azure.com", deployment: "my model!", apiKey: KEY }).problem!, /deployment name/);
  assert.match(checkAzureInput({ endpoint: "https://acme-ai.openai.azure.com", deployment: "gpt-4o", apiKey: "short" }).problem!, /KEY 1/);
});

test("explains Azure's errors", () => {
  assert.match(azureErrorText(401, ""), /didn't accept the key/);
  assert.match(azureErrorText(404, ""), /deployment name/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { labelOutcome, guardFalseSuccess } from "./workTools.js";
import { ownToolsFor } from "./anyAiTools.js";

test("desktop results say plainly whether they worked", () => {
  assert.equal(labelOutcome('Couldn\'t find a window matching "x".'), 'FAILED - Couldn\'t find a window matching "x".');
  assert.equal(labelOutcome("Opened TextEdit."), "DONE - Opened TextEdit.");
  assert.equal(labelOutcome("FAILED - already labelled"), "FAILED - already labelled");
});

test("a false 'done' after a failed tool gets a correction", () => {
  const fixed = guardFalseSuccess("TextEdit has been opened.", ['FAILED - Couldn\'t find a window matching "x".']);
  assert.match(fixed, /^TextEdit has been opened\.\n\n\(Correction: that didn't actually work - Couldn't find a window/);
  assert.equal(guardFalseSuccess("Sorry, I couldn't open it.", ["FAILED - no such app"]), "Sorry, I couldn't open it.");
  assert.equal(guardFalseSuccess("Done.", ["FAILED - first try", "DONE - Opened TextEdit."]), "Done.", "a later success counts");
  assert.equal(guardFalseSuccess("Here's your answer.", []), "Here's your answer.");
});

test("desktop tools are offered for app and file requests", () => {
  assert.ok(ownToolsFor("Open TextEdit").includes("desktop_files"));
  assert.ok(ownToolsFor("Type the total into Excel").includes("desktop_apps"));
  assert.ok(!ownToolsFor("What's the capital of France?").includes("desktop_files"));
});

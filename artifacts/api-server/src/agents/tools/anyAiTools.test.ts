import { test } from "node:test";
import assert from "node:assert/strict";
import { ownToolsFor } from "./anyAiTools.js";

test("offers task tools only when the request is about tasks", () => {
  assert.deepEqual(ownToolsFor("Add a task to call Dana on Friday"), ["create_task", "list_tasks", "update_task"]);
  assert.deepEqual(ownToolsFor("Remind me to send the forecast"), ["create_task", "list_tasks", "update_task"]);
  assert.deepEqual(ownToolsFor("What is a bank reconciliation?"), []);
});

test("offers web fetch only for links or websites; never shell or file tools", () => {
  assert.deepEqual(ownToolsFor("Summarise https://example.com/report"), ["fetch_url"]);
  const all = ownToolsFor("task https://x.y run command write file");
  assert.ok(!all.includes("run_command") && !all.includes("write_file"));
});

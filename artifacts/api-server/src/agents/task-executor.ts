/**
 * Task executor — orchestrates multi-step task runs using Claude with tools.
 * Each step is persisted to the DB and broadcast via taskEvents.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { taskRunsTable, type TaskStep } from "@workspace/db";
import { eq } from "drizzle-orm";
import { TOOL_DEFINITIONS } from "./tools/definitions.js";
import { dispatchTool } from "./tools/dispatcher.js";
import { emitTaskEvent } from "./taskEvents.js";
import { logger } from "../lib/logger.js";
import { buildClassificationRequest, parseClassification, type Complexity } from "./commandClassifier.js";
import { getAnthropicClient } from "../lib/anthropicClient.js";

// ── Step planning ─────────────────────────────────────────────

async function planSteps(command: string): Promise<string[]> {
  try {
    const client = await getAnthropicClient();
    const res = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 512,
      system:
        "You plan multi-step AI tasks. Given a user command, output a JSON array of 3–6 step labels. " +
        "Each label is a short action phrase (e.g. 'Reviewing context', 'Searching for relevant information', " +
        "'Drafting the response', 'Formatting result'). Reply with ONLY the JSON array, no markdown.",
      messages: [{ role: "user", content: `Plan steps for: "${command}"` }],
    });
    const text = res.content[0]?.type === "text" ? res.content[0].text : "[]";
    const match = text.match(/\[[\s\S]*\]/);
    const parsed = match ? JSON.parse(match[0]) : [];
    const steps = Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
    return steps.length >= 2 ? steps.slice(0, 6) : ["Analyzing the request", "Processing", "Formulating response"];
  } catch (err) {
    logger.warn({ err }, "Step planning failed, using defaults");
    return ["Analyzing the request", "Processing", "Generating response"];
  }
}

// ── Complexity classification (design-spec.md §11.1) ───────────

/**
 * §11.1: the `simple` agent type exists specifically to skip planSteps()
 * (a whole extra Claude call) for one-shot requests that need no tools.
 * This classification call is itself cheap by construction (see
 * commandClassifier.ts's tiny max_tokens) - it's meant to pay for
 * itself, not add a second expensive call in front of the first one.
 */
async function classifyComplexity(command: string): Promise<Complexity> {
  try {
    const client = await getAnthropicClient();
    const req = buildClassificationRequest(command);
    const res = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: req.maxTokens,
      system:     req.system,
      messages:   [{ role: "user", content: req.userMessage }],
    });
    const text = res.content[0]?.type === "text" ? res.content[0].text : "";
    return parseClassification(text);
  } catch (err) {
    logger.warn({ err }, "Complexity classification failed, defaulting to complex");
    return "complex";
  }
}

// ── Shared tool-calling loop ────────────────────────────────────

/**
 * The actual Claude-with-tools loop, extracted from what used to be
 * inline in executeStep() so both the existing multi-step orchestrator
 * path and the new single-shot `simple` path (runSimple, below) share
 * one implementation instead of two copies that could drift.
 */
async function runToolLoop(systemPrompt: string, userMessage: string, taskId: string): Promise<string> {
  const client = await getAnthropicClient();
  let messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  let content = "";
  const MAX_TOOL_ITERS = 6;

  for (let i = 0; i < MAX_TOOL_ITERS; i++) {
    const res = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 4096,
      system:     systemPrompt,
      messages,
      tools:      TOOL_DEFINITIONS,
    });

    if (res.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: res.content });
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        const input = block.input as Record<string, unknown>;

        // Emit trace event so SSE clients see live tool activity
        emitTaskEvent(taskId, { type: "trace", toolName: block.name, phase: "start", input });

        try {
          const result = await dispatchTool(block.name, input);
          emitTaskEvent(taskId, { type: "trace", toolName: block.name, phase: "done", preview: result.slice(0, 200) });
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          emitTaskEvent(taskId, { type: "trace", toolName: block.name, phase: "error", error });
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: `Error: ${error}`, is_error: true });
        }
      }
      messages.push({ role: "user", content: toolResults });
    } else {
      const block = res.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text");
      content = block?.text ?? "";
      break;
    }
  }

  return content;
}

// ── Single step execution (orchestrator path) ──────────────────

async function executeStep(
  command: string,
  step: TaskStep,
  completedSteps: TaskStep[],
  currentPreview: string,
  taskId: string,
): Promise<{ output: string; preview: string }> {
  const context = completedSteps
    .map((s) => `[${s.label}]: ${s.output ?? "done"}`)
    .join("\n");

  const systemPrompt = [
    `You are Khameleon, an AI assistant executing a multi-step task.`,
    `Overall command: "${command}"`,
    `Current step (${step.index + 1}): "${step.label}"`,
    context ? `\nCompleted steps:\n${context}` : "",
    currentPreview ? `\nCurrent work product:\n${currentPreview}` : "",
    `\nExecute this step. Use your tools if they help. After completing, your response MUST contain:`,
    `STEP_RESULT: <one or two sentences describing what was accomplished>`,
    `WORK_PRODUCT:\n<the complete current state of the work product being built — this accumulates>`,
  ].join("\n");

  const content = await runToolLoop(systemPrompt, `Execute step: "${step.label}"`, taskId);

  // Parse STEP_RESULT and WORK_PRODUCT
  const resultMatch  = content.match(/STEP_RESULT:\s*([\s\S]*?)(?=\nWORK_PRODUCT:|$)/);
  const productMatch = content.match(/WORK_PRODUCT:\s*([\s\S]*)/);
  const output  = resultMatch?.[1]?.trim()  ?? content.slice(0, 300).trim();
  const preview = productMatch?.[1]?.trim() ?? currentPreview;
  return { output, preview };
}

// ── Single-shot execution (simple path, §11.1) ─────────────────

/**
 * The whole point of the `simple` agent type: one call, no planning
 * call first, no STEP_RESULT/WORK_PRODUCT scaffolding a one-shot answer
 * doesn't need. Still goes through the same tool loop (a "simple"
 * classification isn't a promise no tool will ever be called, just
 * that none was expected to be needed - the model can still reach for
 * one if the request turns out to need it).
 */
async function runSimple(command: string, taskId: string): Promise<{ output: string; preview: string }> {
  const systemPrompt = [
    `You are Khameleon, an AI assistant. The user's request was classified as a simple,`,
    `single-shot request - answer it directly and completely in this one response.`,
    `Use a tool only if you genuinely need to; most requests classified this way need none.`,
  ].join("\n");

  const content = await runToolLoop(systemPrompt, command, taskId);
  const output = content.trim();
  return { output, preview: output };
}

// ── Main entry point ──────────────────────────────────────────

/** Starts or resumes a task run. Safe to call from an Express route (non-blocking). */
export function startTaskRun(taskId: string, retryFromStep = 0): void {
  runTask(taskId, retryFromStep).catch((err) =>
    logger.error({ err, taskId }, "Task run uncaught error")
  );
}

async function runTask(taskId: string, retryFromStep: number): Promise<void> {
  const [task] = await db.select().from(taskRunsTable).where(eq(taskRunsTable.id, taskId)).limit(1);
  if (!task) return;

  const emit = (type: string, payload: Record<string, unknown>) =>
    emitTaskEvent(taskId, { type, ...payload } as Parameters<typeof emitTaskEvent>[1]);

  try {
    // Mark as running
    await db.update(taskRunsTable)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(taskRunsTable.id, taskId));
    emit("status", { status: "running" });

    // Plan steps (or restore from prior run)
    let steps: TaskStep[] = (task.steps ?? []) as TaskStep[];
    // §11.1: classified once, on the first run only - a retry reuses
    // whichever path the task already committed to rather than
    // reclassifying (the command hasn't changed, and re-litigating the
    // agent type mid-retry would risk a `simple` run growing extra
    // steps it never had, or vice versa).
    let agentType: string = task.agentType ?? "orchestrator";

    if (steps.length === 0) {
      const complexity = await classifyComplexity(task.commandText);
      agentType = complexity === "simple" ? "simple" : "orchestrator";

      steps = agentType === "simple"
        ? [{ index: 0, label: "Answering directly", status: "pending" }]
        : (await planSteps(task.commandText)).map((label, index) => ({
            index, label,
            status: index >= retryFromStep ? "pending" : "done",
          }));

      await db.update(taskRunsTable)
        .set({ steps, agentType, updatedAt: new Date() })
        .where(eq(taskRunsTable.id, taskId));
      emit("steps", { steps });
    } else if (retryFromStep > 0) {
      // Reset steps from the retry point
      steps = steps.map((s) =>
        s.index >= retryFromStep
          ? { ...s, status: "pending", output: undefined, startedAt: undefined, completedAt: undefined }
          : s
      );
      await db.update(taskRunsTable)
        .set({ steps, status: "running", errorMessage: null, updatedAt: new Date() })
        .where(eq(taskRunsTable.id, taskId));
      emit("steps", { steps });
    }

    let preview = task.previewContent ?? "";

    // Execute each pending step
    for (let i = retryFromStep; i < steps.length; i++) {
      const runningStep: TaskStep = { ...steps[i], status: "running", startedAt: new Date().toISOString() };
      steps = steps.map((s) => (s.index === i ? runningStep : s));

      await db.update(taskRunsTable)
        .set({ steps, updatedAt: new Date() })
        .where(eq(taskRunsTable.id, taskId));
      emit("step", { step: runningStep });

      const completedSteps = steps.filter((s) => s.status === "done");
      const result = agentType === "simple"
        ? await runSimple(task.commandText, taskId)
        : await executeStep(task.commandText, runningStep, completedSteps, preview, taskId);

      preview = result.preview || preview;
      const doneStep: TaskStep = {
        ...runningStep,
        status: "done",
        output: result.output,
        completedAt: new Date().toISOString(),
      };
      steps = steps.map((s) => (s.index === i ? doneStep : s));

      await db.update(taskRunsTable)
        .set({ steps, previewContent: preview, updatedAt: new Date() })
        .where(eq(taskRunsTable.id, taskId));

      emit("step",    { step: doneStep });
      emit("preview", { preview });
    }

    // Finalize
    const lastOutput  = steps[steps.length - 1]?.output ?? "";
    const summary     = lastOutput.length > 160 ? lastOutput.slice(0, 157) + "…" : lastOutput;
    const now         = new Date();
    await db.update(taskRunsTable)
      .set({ status: "completed", resultSummary: summary, completedAt: now, updatedAt: now })
      .where(eq(taskRunsTable.id, taskId));
    emit("done", { summary, preview });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    // Find the running step to mark as failed
    const runningIdx = ((task.steps as TaskStep[]) ?? []).findIndex((s) => s.status === "running");
    const stepsSnapshot = ((task.steps as TaskStep[]) ?? []).map((s) =>
      s.status === "running" ? { ...s, status: "failed" } : s
    );
    await db.update(taskRunsTable)
      .set({
        status:        "failed",
        errorMessage,
        steps:         stepsSnapshot,
        retryFromStep: runningIdx >= 0 ? runningIdx : (retryFromStep || 0),
        updatedAt:     new Date(),
      })
      .where(eq(taskRunsTable.id, taskId));
    emit("error", { error: errorMessage, retryFromStep: runningIdx >= 0 ? runningIdx : 0 });
  }
}

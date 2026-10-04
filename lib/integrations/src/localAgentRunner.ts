import Anthropic from "@anthropic-ai/sdk";
import type { Runners } from "./coordinator";
import { LOCAL_TOOL_DEFINITIONS, dispatchLocalTool, type DocumentTextReader } from "./tools.js";

const SYSTEM = `You are Khameleon, a local desktop assistant running on the user's own Mac. You take real actions using four tools:
- window_command: open/move/dock/close floating widgets; observe/control third-party apps already open on the desktop (shows the user a colored border); once "controlling" a window, click and type into it like a real user would
- file_command: create folders, move/trash files, sort a folder, open/quit apps
- memory_command: remember/recall facts, save/search notes
- read_document: read the real text of a local PDF or photo (including scanned/photographed documents via on-device OCR) - NOT for documents the user has flagged sensitive/private, see that tool's own description

A single request may require many tool calls in a row - for example "read this PDF's revenue figure and put it in the open spreadsheet" is: read_document once, then window_command to control the spreadsheet, then window_command to click the right cell, then window_command to type the value - in order, as separate calls, before replying with text. When filling in multiple figures (e.g. several cells of a spreadsheet), click and type for each one in turn - don't guess you can do it in one call. Call as many tools as the request needs, in order, before replying with text. Only reply with text once every action the user asked for has actually been taken.

After all needed actions are complete, reply with one short, plain-language confirmation of what you did. Do not repeat tool output verbatim, and do not describe actions you didn't actually take.`;

export interface LocalToolCallRecord {
  name: string;
  input: Record<string, unknown>;
  result: string;
  error?: string;
}

export interface LocalAgentTurnResult {
  /** Final natural-language reply to show the user. */
  reply: string;
  /** Every tool call made while producing this reply, in order. */
  toolCalls: LocalToolCallRecord[];
}

/**
 * Minimal shape of the Anthropic client this runner actually calls.
 * Narrowed so tests can inject a fake client without a real API key or
 * network access — see test/localAgentRunner.test.ts.
 */
export interface AnthropicMessagesClient {
  messages: {
    create(params: Anthropic.Messages.MessageCreateParamsNonStreaming): Promise<Anthropic.Messages.Message>;
  };
}

/**
 * Runs a genuine multi-step, tool-calling agent loop against the three local
 * action tools, in contrast to KhameleonCoordinator's single-shot "pick one
 * capability" router. This is what lets a single instruction like "open a
 * YouTube video enlarged, then move it aside" actually execute as two
 * real actions instead of requiring two separate commands.
 */
export class LocalAgentRunner {
  constructor(
    private runners: Runners,
    private client: AnthropicMessagesClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
    private model: string = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
    // Was 6 - too low once real multi-cell spreadsheet-filling became a
    // real workflow (Cross-App Control Phase 4): read a document, then
    // click+type once per figure, easily exceeds that for 3+ figures.
    private maxIterations: number = 12,
    /** Reads a non-sensitive document's real text for the read_document
     * tool. Optional so existing callers/tests that never touch it don't
     * need to supply one. */
    private readDocumentText?: DocumentTextReader,
  ) {}

  async run(text: string): Promise<LocalAgentTurnResult> {
    if (!text.trim()) throw new Error("A non-empty command is required.");

    const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: text }];
    const toolCalls: LocalToolCallRecord[] = [];

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: SYSTEM,
        tools: LOCAL_TOOL_DEFINITIONS,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const block = response.content.find(
          (b): b is Anthropic.Messages.TextBlock => b.type === "text",
        );
        return { reply: block?.text ?? "", toolCalls };
      }

      messages.push({ role: "assistant", content: response.content });
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const input = block.input as Record<string, unknown>;

        try {
          const result = await dispatchLocalTool(block.name, input, this.runners, this.readDocumentText);
          toolCalls.push({ name: block.name, input, result });
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          toolCalls.push({ name: block.name, input, result: "", error });
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${error}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }

    return {
      reply: "Reached the maximum number of actions for this request without finishing — try breaking it into smaller steps.",
      toolCalls,
    };
  }
}

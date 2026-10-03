import { readFile } from "node:fs/promises";
import { getLlama, resolveModelFile, LlamaChatSession, type Llama, type LlamaModel, type LlamaContext } from "node-llama-cpp";
import { PDFParse } from "pdf-parse";

/**
 * Pulled out as a pure function so it's testable without the model/PDF
 * dependencies this class otherwise needs - everything else here needs a
 * multi-gigabyte model loaded to exercise meaningfully, which real,
 * hands-on verification (not a unit test) already covered - see
 * khameleon-decisions-log.md, 2026-10-03.
 */
export function truncateForModel(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}

function buildPrompt(documentText: string, truncated: boolean, question: string): string {
  return [
    "You are reading a document entirely offline to answer a question about it.",
    "Base your answer only on the document text below - don't invent figures or details it doesn't contain.",
    truncated ? "(Note: this document was long and has been truncated to its first portion.)" : "",
    "--- DOCUMENT TEXT ---",
    documentText,
    "--- END DOCUMENT TEXT ---",
    "",
    `Question: ${question}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Reads and answers questions about a document entirely offline - no
 * network call, no Anthropic SDK, no dependency on LocalAgentRunner or any
 * cloud-backed class. This is a deliberately SEPARATE, parallel path, not a
 * tool LocalAgentRunner can call: a tool's result flows back into that
 * class's cloud conversation on the next iteration, which would send
 * whatever this extracts (or a close paraphrase of it) to Anthropic's API
 * anyway - exactly what "sensitive/local mode" exists to prevent. Keeping
 * this a wholly separate class is what makes "never leaves the device" an
 * honest claim rather than a leaky one (Cross-App Control Phase 3,
 * khameleon-decisions-log.md, 2026-10-03).
 *
 * Scope, stated honestly: reads real PDFs that already contain selectable
 * text (the common case for digitally-produced reports/invoices/contracts),
 * via pure-JS extraction (pdf-parse) - no OCR. A scanned/photographed
 * document with no embedded text layer isn't covered by this; that needs
 * on-device OCR (macOS Vision / Windows.Media.Ocr), deliberately deferred
 * as a named follow-on, not silently promised here.
 *
 * Noticeably weaker than Claude at nuanced interpretation - this is a small
 * (1.5B parameter) model chosen specifically to be realistic to bundle and
 * run on an ordinary laptop. Good at straightforward extraction (figures,
 * labels, direct questions), set as the honest expectation with Newton
 * before this was built.
 */
export class LocalDocumentAgent {
  private llama: Llama | null = null;
  private model: LlamaModel | null = null;
  private context: LlamaContext | null = null;

  constructor(
    /** A node-llama-cpp model URI/path - defaults to a small, real,
     * already-verified-working instruct model. Override for a different
     * size/capability tradeoff. */
    private readonly modelUri: string = "hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q4_K_M",
    /** Max characters of extracted document text to feed the model - keeps
     * prompts within the small model's context window. Long documents are
     * truncated with an honest note, not silently cut with no indication. */
    private readonly maxDocumentChars: number = 12_000,
  ) {}

  /** Downloads (first run only) and loads the local model. Safe to call
   * more than once - later calls reuse the already-loaded model. */
  private async ensureLoaded(): Promise<LlamaContext> {
    if (this.context) return this.context;

    this.llama ??= await getLlama();
    const modelPath = await resolveModelFile(this.modelUri);
    this.model ??= await this.llama.loadModel({ modelPath });
    const context = await this.model.createContext();
    this.context = context;
    return context;
  }

  /** Real text extraction from a PDF already containing a text layer - see
   * the class doc comment for what this does NOT cover (scanned/image PDFs). */
  private async extractText(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  /**
   * Answers a question about a local PDF, entirely offline. Every byte of
   * the document and the model's reasoning about it stays on this machine -
   * the only network activity possible here at all is the one-time model
   * download (resolveModelFile), which never runs again once the model
   * file exists locally.
   */
  async answerAboutDocument(filePath: string, question: string): Promise<string> {
    const fullText = await this.extractText(filePath);
    const { text: documentText, truncated } = truncateForModel(fullText, this.maxDocumentChars);

    const context = await this.ensureLoaded();
    const session = new LlamaChatSession({ contextSequence: context.getSequence() });

    return session.prompt(buildPrompt(documentText, truncated, question));
  }

  /** Releases the loaded model from memory. Call when switching away from
   * local/sensitive mode for a while - the model otherwise stays resident
   * (by design, so repeated questions about the same session don't reload
   * a multi-gigabyte model each time). */
  async dispose(): Promise<void> {
    await this.context?.dispose();
    await this.model?.dispose();
    this.context = null;
    this.model = null;
  }
}

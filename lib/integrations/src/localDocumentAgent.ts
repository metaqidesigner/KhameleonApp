import { getLlama, resolveModelFile, LlamaChatSession, type Llama, type LlamaModel, type LlamaContext } from "node-llama-cpp";
import { extractDocumentText, type DocumentTextSource } from "./documentImport.js";

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

export interface ReceiptLineItem {
  description: string;
  amount: string | null;
}

export interface ReceiptDetails {
  vendor: string;
  date: string | null;
  totalAmount: string | null;
  taxAmount: string | null;
  currency: string | null;
  paymentMethod: string | null;
  category: string | null;
  lineItems: ReceiptLineItem[];
  /** What the model actually saw, so a user (or their accountant) can
   * sanity-check a field against the real source when OCR noise is a
   * real concern - "detailed identification... is critical" (Newton's own
   * words asking for this). */
  rawText: string;
  textSource: DocumentTextSource;
}

const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    vendor: { type: "string" },
    date: { type: ["string", "null"] },
    totalAmount: { type: ["string", "null"] },
    taxAmount: { type: ["string", "null"] },
    currency: { type: ["string", "null"] },
    paymentMethod: { type: ["string", "null"] },
    category: { type: ["string", "null"] },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          amount: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

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
 * Reads real PDFs with a text layer directly, and falls back to real
 * on-device OCR (Tesseract, via documentImport.ts) for scanned PDFs and
 * photo files (JPEG/PNG/HEIC) - the scanned-receipt/photo gap originally
 * deferred from Phase 3 was closed the same day, once it turned out to
 * block something Newton considers critical (tax receipts).
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
  private async ensureLoaded(): Promise<{ llama: Llama; context: LlamaContext }> {
    this.llama ??= await getLlama();
    if (!this.context) {
      const modelPath = await resolveModelFile(this.modelUri);
      this.model ??= await this.llama.loadModel({ modelPath });
      this.context = await this.model.createContext();
    }
    return { llama: this.llama, context: this.context };
  }

  /**
   * Answers a question about a local document, entirely offline. Every
   * byte of the document and the model's reasoning about it stays on this
   * machine - the only network activity possible here at all is the
   * one-time model download (resolveModelFile), which never runs again
   * once the model file exists locally.
   */
  async answerAboutDocument(filePath: string, question: string): Promise<string> {
    const { text: fullText } = await extractDocumentText(filePath);
    const { text: documentText, truncated } = truncateForModel(fullText, this.maxDocumentChars);

    const { context } = await this.ensureLoaded();
    const session = new LlamaChatSession({ contextSequence: context.getSequence() });

    return session.prompt(buildPrompt(documentText, truncated, question));
  }

  /**
   * Extracts structured receipt details entirely offline - vendor, date,
   * amounts, tax, line items - for tax/accounting use. Uses a JSON-schema
   * grammar (node-llama-cpp's createGrammarForJsonSchema) to constrain the
   * model's output, so it's always valid against RECEIPT_SCHEMA rather than
   * hoping a free-text prompt happens to produce parseable JSON - important
   * when the output needs to be reliable, not just plausible-looking.
   */
  async extractReceiptDetails(filePath: string): Promise<ReceiptDetails> {
    const { text: fullText, source } = await extractDocumentText(filePath);
    const { text: documentText, truncated } = truncateForModel(fullText, this.maxDocumentChars);

    const { llama, context } = await this.ensureLoaded();
    const grammar = await llama.createGrammarForJsonSchema(RECEIPT_SCHEMA);
    const session = new LlamaChatSession({ contextSequence: context.getSequence() });

    const prompt = [
      "You are reading a receipt entirely offline to extract its details for tax/accounting records.",
      source === "ocr"
        ? "This text came from OCR on a photo or scan, so it may contain recognition errors - use your judgement to read through minor OCR noise, but never invent a figure the text doesn't support."
        : "Base every field only on the text below - never invent a figure it doesn't contain.",
      "Use null for any field you genuinely cannot determine - do not fill a field with a value that belongs to a different field.",
      "currency: the ISO currency code (e.g. USD, AUD, GBP) ONLY if one is explicitly printed on the receipt - otherwise null. Never put a payment method, card number, or amount in this field.",
      "totalAmount/taxAmount/lineItems amounts: the plain number/currency-symbol amount exactly as printed (e.g. \"$257.90\"), with no extra leading characters.",
      truncated ? "(Note: this document was long and has been truncated to its first portion.)" : "",
      "--- RECEIPT TEXT ---",
      documentText,
      "--- END RECEIPT TEXT ---",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await session.prompt(prompt, { grammar });
    const parsed = grammar.parse(response);

    return { ...parsed, rawText: fullText, textSource: source };
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

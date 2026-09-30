/**
 * Server-side OpenAI-compatible chat client for the Writing Assistant.
 *
 * Reads LLM_API_KEY, LLM_MODEL, LLM_BASE_URL from the environment.
 * All keys stay on the server; this module is never imported by client code.
 */

export class LlmNotConfigured extends Error {
  constructor() {
    super(LLM_MISSING_MESSAGE);
    this.name = "LlmNotConfigured";
  }
}

export const LLM_MISSING_MESSAGE =
  "AI features need an API key. Add LLM_API_KEY (and optionally LLM_MODEL / LLM_BASE_URL) to your environment to enable AI-powered improving and proofreading. Your document, style profile, and all other features keep working.";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  /** Request strict JSON output (sets response_format json_object). */
  jsonMode?: boolean;
  /** Sampling temperature; low default keeps edits conservative. */
  temperature?: number;
  /** Max tokens for the completion. */
  maxTokens?: number;
}

function getConfig(): { apiKey: string; model: string; baseUrl: string } {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new LlmNotConfigured();
  }
  return {
    apiKey: apiKey.trim(),
    model: (process.env.LLM_MODEL ?? "gpt-4o-mini").trim() || "gpt-4o-mini",
    baseUrl:
      (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").trim() ||
      "https://api.openai.com/v1",
  };
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
}

/**
 * Send a chat completion request and return the assistant's text content.
 * Throws LlmNotConfigured when no key is set; throws Error on API failures
 * with a human-readable message (never raw backend internals).
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const { apiKey, model, baseUrl } = getConfig();
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 4000,
  };
  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Could not reach the AI service. Check your network connection and LLM_BASE_URL, then try again."
    );
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "The AI service rejected the API key. Check LLM_API_KEY and try again."
      );
    }
    if (res.status === 429) {
      throw new Error(
        "The AI service is rate-limited right now. Wait a moment and try again."
      );
    }
    throw new Error(
      `The AI service returned an error (status ${res.status}). Try again shortly.`
    );
  }

  let data: ChatCompletionResponse;
  try {
    data = (await res.json()) as ChatCompletionResponse;
  } catch {
    throw new Error("The AI service returned an unreadable response. Try again.");
  }
  if (data.error?.message) {
    throw new Error("The AI service returned an error. Try again shortly.");
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    throw new Error("The AI service returned an empty response. Try again.");
  }
  return content;
}

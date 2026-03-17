/**
 * Shared AI client for Hunter Supabase Edge Functions.
 *
 * Priority order:
 *  1. Vercel AI Gateway (AI_GATEWAY_API_KEY) — single key for Google, Anthropic, OpenAI
 *  2. Direct Gemini API (GEMINI_API_KEY)      — existing deployments / fallback
 *
 * Model naming:
 *  - Via gateway:      "google/gemini-2.5-flash", "anthropic/claude-haiku-4-5", "openai/gpt-4o-mini"
 *  - Via direct Gemini: the "google/" prefix is stripped automatically
 *
 * Usage:
 *   const { callAI } = await import('../_shared/ai-client.ts');
 *   const { content } = await callAI('google/gemini-2.5-flash', messages);
 *   const { content } = await callAI('anthropic/claude-haiku-4-5', messages, { json: true });
 *   const { tool_calls } = await callAI('google/gemini-2.5-flash', messages, { tools, tool_choice });
 */

export type AIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface AIOptions {
  /** Request JSON-only response (`response_format: {type: 'json_object'}`) */
  json?: boolean;
  /** Tool definitions for function calling */
  tools?: unknown[];
  /** Force a specific tool call */
  tool_choice?: unknown;
  /** AbortSignal for timeout control */
  signal?: AbortSignal;
}

export interface AIResponse {
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

// ─── Model routing presets ────────────────────────────────────────────────────
//
// Use these constants throughout functions for consistent model selection.

/** High-quality text generation (cover letters, natural prose) */
export const MODEL_CONTENT   = 'anthropic/claude-haiku-4-5';
/** Fast structured extraction + general tasks */
export const MODEL_FAST      = 'google/gemini-2.5-flash';
/** Complex multi-step reasoning (dossiers, analysis) */
export const MODEL_REASONING = 'google/gemini-2.5-pro';

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Call an AI model via the Vercel AI Gateway, with automatic Gemini direct fallback.
 */
export async function callAI(
  model: string,
  messages: AIMessage[],
  options: AIOptions = {},
): Promise<AIResponse> {
  const gatewayKey = Deno.env.get('AI_GATEWAY_API_KEY');
  const geminiKey  = Deno.env.get('GEMINI_API_KEY');

  if (!gatewayKey && !geminiKey) {
    throw new Error('[ai-client] No AI key found. Set AI_GATEWAY_API_KEY or GEMINI_API_KEY.');
  }

  if (gatewayKey) {
    return _callGateway(gatewayKey, model, messages, options);
  }

  // Direct Gemini fallback — strip provider prefix
  const geminiModel = model.startsWith('google/') ? model.slice(7) : 'gemini-2.5-flash';
  return _callGeminiDirect(geminiKey!, geminiModel, messages, options);
}

// ─── Vercel AI Gateway ────────────────────────────────────────────────────────

async function _callGateway(
  apiKey: string,
  model: string,
  messages: AIMessage[],
  options: AIOptions,
): Promise<AIResponse> {
  const body: Record<string, unknown> = { model, messages };
  if (options.json)        body.response_format = { type: 'json_object' };
  if (options.tools)       body.tools = options.tools;
  if (options.tool_choice) body.tool_choice = options.tool_choice;

  const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`[ai-client] Gateway ${res.status}: ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  return { content: msg?.content ?? null, tool_calls: msg?.tool_calls };
}

// ─── Direct Gemini (OpenAI-compatible endpoint) ───────────────────────────────

async function _callGeminiDirect(
  apiKey: string,
  model: string,
  messages: AIMessage[],
  options: AIOptions,
): Promise<AIResponse> {
  const body: Record<string, unknown> = { model, messages };
  if (options.json)        body.response_format = { type: 'json_object' };
  if (options.tools)       body.tools = options.tools;
  if (options.tool_choice) body.tool_choice = options.tool_choice;

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`[ai-client] Gemini ${res.status}: ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  return { content: msg?.content ?? null, tool_calls: msg?.tool_calls };
}

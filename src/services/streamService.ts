// ============================================================
// services/streamService.ts — Sarvam AI API streaming service
//
// Uses Sarvam AI's OpenAI-compatible chat completions endpoint with
// server-sent events (SSE) streaming.
//
// Environment variables (set in .env):
//   VITE_SARVAM_API_KEY  — your Sarvam AI API key
//   VITE_SARVAM_MODEL    — model ID (default: Sarvam-2B-Instruct)
// ============================================================

const SARVAM_API_URL = '/api/sarvam/chat/completions';
const SARVAM_API_KEY = import.meta.env.VITE_SARVAM_API_KEY as string | undefined;
const SARVAM_MODEL   = (import.meta.env.VITE_SARVAM_MODEL as string | undefined)
  ?? 'sarvam-30b';

export const SYSTEM_PROMPT =
  `You are Sarvam, an intelligent AI assistant built for the Sarvam AI Playground — ` +
  `India's premier AI inference platform. You are helpful, precise, and articulate. ` +
  `Provide accurate, well-reasoned answers. Use markdown formatting (bold, lists, ` +
  `code blocks) where it genuinely improves readability. Be concise but thorough.`;

export type SarvamRole = 'system' | 'user' | 'assistant';

export interface SarvamMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Backward compatibility export
export type GroqMessage = SarvamMessage;

// ── Main streaming function ───────────────────────────────────
/**
 * Calls Sarvam AI's chat completions API with SSE streaming.
 * Returns a ReadableStream<string> that yields text deltas as they arrive.
 *
 * @param messages  Full conversation history (user + assistant turns)
 * @param signal    AbortSignal for cancellation
 */
export async function fetchSarvamStream(
  messages: SarvamMessage[],
  signal: AbortSignal
): Promise<ReadableStream<string>> {
  if (!SARVAM_API_KEY) {
    throw new Error(
      'Sarvam AI API key not configured. Add VITE_SARVAM_API_KEY to your .env file and restart the dev server.'
    );
  }

  console.log('[DEBUG] Starting stream request...');
  console.log('[DEBUG] Target URL:', SARVAM_API_URL);
  console.log('[DEBUG] Model:', SARVAM_MODEL);
  console.log('[DEBUG] Has API Key:', !!SARVAM_API_KEY);

  const res = await fetch(SARVAM_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'api-subscription-key': SARVAM_API_KEY || '',
    },
    body: JSON.stringify({
      model:      SARVAM_MODEL,
      messages:   [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      stream:     true,
      temperature: 0.72,
      max_tokens:  2048,
    }),
    signal,
  });

  if (!res.ok) {
    // Try to get a meaningful error message from Sarvam AI
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message ?? '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`Sarvam AI API ${res.status}: ${detail || res.statusText}`);
  }

  if (!res.body) throw new Error('Sarvam AI API returned no response body');

  console.log('[DEBUG] Received valid response, status:', res.status);

  // ── SSE parser ───────────────────────────────────────────
  // Sarvam AI streams in the OpenAI SSE format:
  //   data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n
  //   data: [DONE]\n\n
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = '';

  return new ReadableStream<string>({
    async pull(controller) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Flush any remaining buffer
          if (buffer.trim()) processChunk(buffer, controller);
          console.log('[DEBUG] Stream reading complete.');
          controller.close();
          return;
        }

        const decoded = decoder.decode(value, { stream: true });
        buffer += decoded;

        // Failsafe: if Vercel rewrite fails and serves HTML
        if (buffer.trim().startsWith('<!DOCTYPE') || buffer.trim().startsWith('<html')) {
          controller.error(new Error('Received HTML instead of stream. Vercel API rewrite failed.'));
          return;
        }

        // Failsafe: if the response is a raw JSON error
        if (buffer.trim().startsWith('{') && buffer.includes('"error"')) {
          try {
            const errJson = JSON.parse(buffer);
            if (errJson.error) {
              controller.error(new Error(errJson.error.message || 'API Error in JSON response'));
              return;
            }
          } catch { /* ignore partial JSON */ }
        }

        // Split on newlines; keep the last incomplete line in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const result = processChunk(line, controller);
          if (result === 'done') { controller.close(); return; }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

/** Process one SSE line. Returns 'done' if [DONE] was received. */
function processChunk(
  line: string,
  controller: ReadableStreamDefaultController<string>
): 'done' | void {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data: ')) return;

  const data = trimmed.slice(6).trim();
  if (data === '[DONE]') return 'done';

  try {
    const json  = JSON.parse(data);
    const deltaObj = json?.choices?.[0]?.delta;
    if (deltaObj) {
      const text = deltaObj.content;
      if (text) controller.enqueue(text);
    }
  } catch (err) {
    console.error('[DEBUG] Failed to parse JSON chunk:', data, err);
    // Malformed / empty chunk — skip silently
  }
}

// ── Legacy compat shims ────────────────────────────────────────
// Kept so nothing else in the project breaks if it still imports fetchStream or fetchGroqStream.
export async function fetchStream(
  prompt: string,
  signal: AbortSignal
): Promise<ReadableStream<string>> {
  return fetchSarvamStream([{ role: 'user', content: prompt }], signal);
}

// Backward compatibility for existing imports
export const fetchGroqStream = fetchSarvamStream;

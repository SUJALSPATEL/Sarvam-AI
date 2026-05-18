// ============================================================
// services/diffStreamService.ts — Dual-model streaming for Diff Viewer
//
// Streams two Sarvam AI models simultaneously for the same prompt.
// Returns per-model ReadableStream<string> with latency tracking.
// ============================================================

const SARVAM_API_URL = import.meta.env.DEV 
  ? '/api/sarvam/chat/completions' 
  : 'https://api.sarvam.ai/v1/chat/completions';
const SARVAM_API_KEY = import.meta.env.VITE_SARVAM_API_KEY as string | undefined;

// Hardcoded models used in DiffViewer
export interface StreamResult {
  stream: ReadableStream<string>;
  startTime: number; // performance.now() at request start
}

const DIFF_SYSTEM_PROMPT =
  `You are an expert AI assistant. Provide a clear, well-structured response to the user's prompt. ` +
  `Be thorough yet concise. Use markdown formatting where it helps readability.`;

/** Process one SSE line and push text delta to controller */
function processSSELine(
  line: string,
  controller: ReadableStreamDefaultController<string>
): 'done' | void {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data: ')) return;
  const data = trimmed.slice(6).trim();
  if (data === '[DONE]') return 'done';
  try {
    const json = JSON.parse(data);
    const delta = json?.choices?.[0]?.delta?.content;
    if (delta) controller.enqueue(delta);
  } catch (err) {
    console.error(`[DEBUG] Failed to parse JSON chunk:`, data, err);
    // skip malformed chunks
  }
}

/**
 * Stream a single model's response to a prompt.
 * Returns a ReadableStream<string> that yields text deltas.
 */
export async function streamModelResponse(
  prompt: string,
  modelId: string,
  signal: AbortSignal
): Promise<StreamResult> {
  if (!SARVAM_API_KEY) {
    throw new Error(
      'Sarvam AI API key not configured. Add VITE_SARVAM_API_KEY to your .env file.'
    );
  }

  const startTime = performance.now();

  console.log(`[DEBUG] Starting diff stream request for model: ${modelId}...`);
  console.log(`[DEBUG] Target URL:`, SARVAM_API_URL);
  console.log(`[DEBUG] Has API Key:`, !!SARVAM_API_KEY);

  const res = await fetch(SARVAM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': SARVAM_API_KEY || '',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: DIFF_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 1024,
    }),
    signal,
  });

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message ?? '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`Sarvam AI API ${res.status} (${modelId}): ${detail || res.statusText}`);
  }

  if (!res.body) throw new Error(`No response body from ${modelId}`);

  console.log(`[DEBUG] Received valid response for ${modelId}, status:`, res.status);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const stream = new ReadableStream<string>({
    async pull(controller) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) processSSELine(buffer, controller);
          console.log(`[DEBUG] Stream reading complete for ${modelId}.`);
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const result = processSSELine(line, controller);
          if (result === 'done') {
            controller.close();
            return;
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return { stream, startTime };
}

/**
 * Launch both model streams concurrently for the same prompt.
 * Returns both StreamResults so the UI can read them independently.
 */
export async function streamBothModels(
  prompt: string,
  modelAId: string,
  modelBId: string,
  signalA: AbortSignal,
  signalB: AbortSignal
): Promise<{ resultA: StreamResult; resultB: StreamResult }> {
  const [resultA, resultB] = await Promise.all([
    streamModelResponse(prompt, modelAId, signalA),
    streamModelResponse(prompt, modelBId, signalB),
  ]);
  return { resultA, resultB };
}

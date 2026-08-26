import { z } from 'zod';

import { env } from '../env.js';
import { fetchOk } from '../lib/http.js';

const HUGGINGFACE_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions';
const MAX_RESPONSE_TOKENS = 250;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const chatCompletionResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })),
});

// This client skips getCachedContent: its cache key is per-user-per-day, known
// only to the M4 dashboard module that calls it.
export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  // A missing token is just another upstream failure for the caller's
  // degradation path to absorb, not a reason to stop the API booting.
  if (env.HUGGINGFACE_API_TOKEN === undefined) {
    throw new Error('HUGGINGFACE_API_TOKEN is not configured');
  }

  const response = await fetchOk(HUGGINGFACE_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.HUGGINGFACE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.HUGGINGFACE_MODEL,
      messages,
      max_tokens: MAX_RESPONSE_TOKENS,
    }),
  });

  const body: unknown = await response.json();
  const parsed = chatCompletionResponseSchema.parse(body);

  const [firstChoice] = parsed.choices;
  if (!firstChoice) throw new Error('Hugging Face returned no choices');

  return firstChoice.message.content;
}

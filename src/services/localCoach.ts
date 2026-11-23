import { runLocalLlmChat, type ModelDownloadProgress } from './localAi';
import { type OfflineCoachLevel } from './localAiConfig';
import { buildOfflineCoachSystemPrompt } from '../utils/tutorPolicyClient';

export interface OfflineCoachMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface OfflineCoachOptions {
  level: OfflineCoachLevel;
  onToken?: (partialText: string) => void;
  onProgress?: (progress: ModelDownloadProgress) => void;
  signal?: AbortSignal;
}

const SLIDING_WINDOW_TURNS = 6;

/**
 * Runs the AI Study Coach 100% locally in the browser Web Worker with zero cloud requests.
 * Keeps a 6-message sliding window so KV cache fits safely within 8 GB laptop RAM budgets.
 */
export async function sendOfflineCoachMessage(
  messages: OfflineCoachMessage[],
  context: any,
  opts: OfflineCoachOptions
): Promise<string> {
  // Drop initial assistant welcome greeting if it's message 0, then keep last 6 turns.
  const cleaned = messages.filter((m, idx) => !(idx === 0 && m.role === 'assistant'));
  const windowed = cleaned.slice(-SLIDING_WINDOW_TURNS);
  const lastUser = [...windowed].reverse().find((m) => m.role === 'user')?.content || '';

  const systemPrompt = buildOfflineCoachSystemPrompt(context, lastUser);

  const reply = await runLocalLlmChat({
    level: opts.level,
    messages: windowed.length > 0 ? windowed : [{ role: 'user', content: 'Hello!' }],
    systemPrompt,
    maxNewTokens: opts.level === 'deeper' ? 240 : 200,
    onToken: opts.onToken,
    onProgress: opts.onProgress,
    signal: opts.signal,
  });

  return reply;
}

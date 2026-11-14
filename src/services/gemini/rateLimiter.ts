import { checkDailyQuota } from './providers';

export class GeminiRateLimiter {
  private tokens = 15;
  private maxTokens = 15;
  private refillIntervalMs = 60000;
  private lastRefill = Date.now();
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      const refillCount = Math.floor(elapsed / this.refillIntervalMs) * 15;
      this.tokens = Math.min(this.maxTokens, this.tokens + refillCount);
      this.lastRefill = now;
    }
  }
  private async acquireToken(): Promise<void> {
    this.refill();
    if (this.tokens > 0) { this.tokens -= 1; return; }
    const wait = this.refillIntervalMs - (Date.now() - this.lastRefill);
    await new Promise(r => setTimeout(r, Math.max(0, wait)));
    return this.acquireToken();
  }
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        let attempts = 0; const maxAttempts = 4;
        while (attempts < maxAttempts) {
          try { await this.acquireToken(); const result = await fn(); resolve(result); return; }
          catch (err: any) {
            attempts++;
            const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED');
            if (is429 && attempts < maxAttempts) {
              this.tokens = Math.max(0, this.tokens - 2);
              const backoffMs = Math.pow(2, attempts) * 1000 + Math.random() * 500;
              console.warn(`Gemini 429 backing off ${Math.round(backoffMs)}ms attempt ${attempts}/${maxAttempts}`);
              await new Promise(r => setTimeout(r, backoffMs));
            } else { reject(err); return; }
          }
        }
      });
      this.processQueue();
    });
  }
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) try { await task(); } catch(e){ console.error(e); }
    }
    this.isProcessing = false;
  }
  getStatus() {
    this.refill();
    return {
      availableTokens: this.tokens,
      maxTokens: this.maxTokens,
      queueLength: this.queue.length,
      nextRefillInMs: Math.max(0, this.refillIntervalMs - (Date.now() - this.lastRefill)),
    };
  }
  canProceed(): boolean {
    if (!checkDailyQuota()) return false;
    this.refill();
    return this.tokens > 0 || this.queue.length < this.maxTokens;
  }
}
export const rateLimiter = new GeminiRateLimiter();

/**
 * Checks whether a Gemini request can proceed under the client token bucket
 * and daily quota budget (server routes enforce per-IP rate limits independently).
 */
export async function canMakeGeminiRequest(): Promise<boolean> {
  return rateLimiter.canProceed();
}

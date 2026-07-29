/**
 * Retry helpers for transient network / Supabase fetch failures.
 */

export function isTransientFetchError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout") ||
    lower.includes("econnrefused") ||
    lower.includes("socket hang up") ||
    lower.includes("und_err") ||
    lower.includes("other side closed") ||
    lower.includes("timeout") ||
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("504") ||
    lower.includes("429")
  );
}

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options?: { attempts?: number; baseDelayMs?: number; throwOnExhausted?: boolean },
): Promise<T> {
  const attempts = options?.attempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 400;
  let lastErr: unknown;

  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const transient = isTransientFetchError(err);
      if (!transient || i === attempts) break;
      const delay = baseDelayMs * 2 ** (i - 1) + Math.floor(Math.random() * 150);
      console.warn(
        `[retry] ${label} attempt ${i}/${attempts} failed (${err instanceof Error ? err.message : String(err)}); waiting ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  if (options?.throwOnExhausted === false) {
    throw lastErr;
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

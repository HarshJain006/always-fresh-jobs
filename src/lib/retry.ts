/**
 * Retry helpers for transient network / Supabase fetch failures.
 */

function collectErrorText(err: unknown, depth = 0): string {
  if (depth > 5 || err == null) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    const cause =
      "cause" in err && err.cause != null ? collectErrorText(err.cause, depth + 1) : "";
    return `${err.message}\n${err.name}\n${cause}`;
  }
  if (typeof err === "object") {
    const o = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [o.message, o.details, o.hint, o.code]
      .filter((v) => v != null && String(v).length > 0)
      .map(String)
      .join("\n");
  }
  return String(err);
}

export function isTransientFetchError(err: unknown): boolean {
  const haystack = collectErrorText(err).toLowerCase();

  return (
    haystack.includes("fetch failed") ||
    haystack.includes("network") ||
    haystack.includes("econnreset") ||
    haystack.includes("etimedout") ||
    haystack.includes("econnrefused") ||
    haystack.includes("socket hang up") ||
    haystack.includes("und_err") ||
    haystack.includes("other side closed") ||
    haystack.includes("timeout") ||
    haystack.includes("aborted") ||
    haystack.includes("eai_again") ||
    haystack.includes("enotfound") ||
    haystack.includes("getaddrinfo") ||
    haystack.includes("dns") ||
    haystack.includes("503") ||
    haystack.includes("502") ||
    haystack.includes("504") ||
    haystack.includes("429")
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

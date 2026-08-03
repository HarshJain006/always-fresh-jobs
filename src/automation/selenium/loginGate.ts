/**
 * Process-local gate so parallel worker slots don't all hit Naukri login at once.
 * One Node worker runs 4 slots — this serializes only the fragile login-page load.
 */

let tail: Promise<unknown> = Promise.resolve();

export async function withLoginGate<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prev = tail;
  tail = prev.then(() => next).catch(() => next);

  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

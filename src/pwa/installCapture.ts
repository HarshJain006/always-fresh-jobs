/**
 * Global PWA install-prompt capture.
 * Must run as early as possible on the client — beforeinstallprompt often fires
 * once on first paint and is lost if only the /download page listens.
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type Listener = () => void;

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let started = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const androidTwa = document.referrer.startsWith("android-app://");
  return mq || iosStandalone || androidTwa;
}

export function startInstallCapture(): void {
  if (typeof window === "undefined" || started) return;
  started = true;

  installed = isStandaloneDisplay();

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });

  // Display-mode can flip after install without a full reload
  try {
    window.matchMedia("(display-mode: standalone)").addEventListener("change", (ev) => {
      if (ev.matches) {
        installed = true;
        deferred = null;
        notify();
      }
    });
  } catch {
    /* older Safari */
  }
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferred;
}

export function clearDeferredInstallPrompt(): void {
  deferred = null;
  notify();
}

export function getInstallCaptureInstalled(): boolean {
  return installed || isStandaloneDisplay();
}

export function markInstallAccepted(): void {
  installed = true;
  deferred = null;
  notify();
}

export function subscribeInstallCapture(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Wait briefly for Chromium to expose the native install prompt. */
export function waitForDeferredInstallPrompt(timeoutMs = 2800): Promise<BeforeInstallPromptEvent | null> {
  const existing = getDeferredInstallPrompt();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: BeforeInstallPromptEvent | null) => {
      if (settled) return;
      settled = true;
      unsub();
      clearTimeout(timer);
      resolve(value);
    };

    const unsub = subscribeInstallCapture(() => {
      const next = getDeferredInstallPrompt();
      if (next) finish(next);
      if (getInstallCaptureInstalled()) finish(null);
    });

    const timer = window.setTimeout(() => finish(getDeferredInstallPrompt()), timeoutMs);
  });
}

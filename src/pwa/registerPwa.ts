/**
 * Register the Progressive Web App service worker and start install capture early.
 */

import { startInstallCapture } from "./installCapture";

declare global {
  interface WindowEventMap {
    beforeinstallprompt: import("./installCapture").BeforeInstallPromptEvent;
  }
}

/** Start capturing install prompts as soon as this module evaluates on the client. */
if (typeof window !== "undefined") {
  startInstallCapture();
}

export function registerPwa(): void {
  if (typeof window === "undefined") return;
  startInstallCapture();

  if (!("serviceWorker" in navigator)) return;

  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

      // Pick up a waiting worker so installability / updates aren't stuck
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            // New SW ready — next navigation/reload activates it
            console.info("[pwa] Update available");
          }
        });
      });

      // Ensure a controller exists ASAP (first visit)
      await navigator.serviceWorker.ready;
    } catch (err) {
      console.warn("PWA service worker registration failed:", err);
    }
  };

  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => void register(), { once: true });
}

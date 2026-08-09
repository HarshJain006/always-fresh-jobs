import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  getInstallCaptureInstalled,
  markInstallAccepted,
  startInstallCapture,
  subscribeInstallCapture,
  waitForDeferredInstallPrompt,
} from "./installCapture";

export type InstallPlatform = "ios" | "android" | "desktop" | "unknown";

export type InstallOutcome =
  | "accepted"
  | "dismissed"
  | "already-installed"
  | "ios-manual"
  | "android-manual"
  | "desktop-manual"
  | "in-app-browser"
  | "unsupported";

function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (iOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return "desktop";
  return "unknown";
}

/** Instagram / Facebook / etc. block PWA install — user must open in the real browser. */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /FBAN|FBAV|FB_IAB|Instagram|Line\/|LinkedInApp|Twitter|Snapchat|MicroMessenger|WhatsApp/i.test(
      ua,
    ) ||
    (/\bwv\b/.test(ua) && /Android/i.test(ua))
  );
}

/** Stable snapshot for useSyncExternalStore (must not allocate a new object each call). */
let cachedCanPrompt = false;
let cachedInstalled = false;

function refreshCache() {
  cachedInstalled = getInstallCaptureInstalled();
  cachedCanPrompt = Boolean(getDeferredInstallPrompt()) && !cachedInstalled;
}

function subscribe(listener: () => void) {
  return subscribeInstallCapture(() => {
    refreshCache();
    listener();
  });
}

function getCanPrompt() {
  refreshCache();
  return cachedCanPrompt;
}

function getInstalled() {
  refreshCache();
  return cachedInstalled;
}

function getServerFalse() {
  return false;
}

/**
 * Device-aware install hook. Always prefer the native Chromium install dialog
 * when available; fall back to platform-specific guidance otherwise.
 */
export function usePwaInstall() {
  const [platform] = useState<InstallPlatform>(() => detectPlatform());
  const [busy, setBusy] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [inAppBrowser] = useState(() =>
    typeof window !== "undefined" ? isInAppBrowser() : false,
  );

  useEffect(() => {
    startInstallCapture();
    refreshCache();
  }, []);

  const canPrompt = useSyncExternalStore(subscribe, getCanPrompt, getServerFalse);
  const installed = useSyncExternalStore(subscribe, getInstalled, getServerFalse);

  useEffect(() => {
    let cancelled = false;
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.then(() => {
        if (!cancelled) setSwReady(true);
      });
    } else {
      setSwReady(true);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (getInstallCaptureInstalled()) return "already-installed";
    if (isInAppBrowser()) return "in-app-browser";

    setBusy(true);
    try {
      // iOS has no programmatic install API — must guide Add to Home Screen
      if (platform === "ios") return "ios-manual";

      let deferred = getDeferredInstallPrompt();
      if (!deferred) {
        if ("serviceWorker" in navigator) {
          try {
            await navigator.serviceWorker.ready;
          } catch {
            /* ignore */
          }
        }
        deferred = await waitForDeferredInstallPrompt(3200);
      }

      if (deferred) {
        try {
          await deferred.prompt();
          const { outcome } = await deferred.userChoice;
          clearDeferredInstallPrompt();
          if (outcome === "accepted") {
            markInstallAccepted();
            return "accepted";
          }
          return "dismissed";
        } catch (err) {
          console.warn("[pwa] install prompt failed:", err);
          clearDeferredInstallPrompt();
        }
      }

      if (platform === "android") return "android-manual";
      if (platform === "desktop") return "desktop-manual";
      return "unsupported";
    } finally {
      setBusy(false);
    }
  }, [platform]);

  return {
    canPrompt,
    installed,
    platform,
    busy,
    swReady,
    inAppBrowser,
    promptInstall,
  };
}

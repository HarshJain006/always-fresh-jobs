/**
 * Register the Progressive Web App service worker (browser only).
 */
export function registerPwa() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("PWA service worker registration failed:", err);
    });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
}

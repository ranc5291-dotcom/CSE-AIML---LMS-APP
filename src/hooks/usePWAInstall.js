import { useState, useEffect, useCallback } from "react";

// Detects iOS Safari specifically — the one major platform where
// `beforeinstallprompt` never fires and "Add to Home Screen" must be
// done manually via the Share sheet.
function isIosSafari() {
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

// True once the app is already installed / running standalone —
// covers both the standard PWA check and iOS's proprietary flag.
function isRunningStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => isRunningStandalone());
  const [isIos] = useState(() => isIosSafari());

  useEffect(() => {
    // If already installed, never show anything — bail early.
    if (isRunningStandalone()) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      // Stop the browser's default mini-infobar so we control the UI.
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: "unavailable" };

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice; // { outcome: "accepted" | "dismissed" }

    // The prompt can only be used once — clear it either way.
    setDeferredPrompt(null);
    setIsInstallable(false);

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }
    return choice;
  }, [deferredPrompt]);

  return {
    isInstallable,   // show a native "Install App" button
    isInstalled,     // never show any install UI
    isIos,           // show manual "Add to Home Screen" instructions instead
    promptInstall,
  };
}
import { createContext, useContext, useState, useEffect, useCallback } from "react";

<<<<<<< HEAD
// Catches ALL iOS browsers (Safari, Chrome, Firefox, Edge, etc.) — on iOS,
// every browser runs on Apple's WebKit engine under the hood, so none of
// them support `beforeinstallprompt` or any native install flow. Only the
// UI copy differs slightly between browsers for "Add to Home Screen".
function isIosDevice() {
  const ua = window.navigator.userAgent;
=======
function isIosDevice() {
  const ua = window.navigator.userAgent;
  // Any iOS browser (Safari, Chrome/CriOS, Firefox/FxiOS, Edge/EdgiOS) —
  // they're all WebKit under the hood on iOS, and none of them support
  // `beforeinstallprompt`. So we detect the OS, not the specific browser.
>>>>>>> 420a8b0 (Update LMS features and PWA installation)
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
}

function isRunningStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

const PWAInstallContext = createContext(null);

// This provider must be mounted as early as possible (at the App root,
// outside any splash-screen/route gating) because the browser fires
// `beforeinstallprompt` very early on page load — often within the first
// second. If the listener attaches late (e.g. only when a button component
// finally mounts after a splash delay), the event has already fired and is
// lost, permanently hiding the install button for that page load.
export function PWAInstallProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => isRunningStandalone());
  const [isIos] = useState(() => isIosDevice());

  useEffect(() => {
    if (isRunningStandalone()) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
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
    const choice = await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setIsInstallable(false);

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }
    return choice;
  }, [deferredPrompt]);

  return (
    <PWAInstallContext.Provider value={{ isInstallable, isInstalled, isIos, promptInstall }}>
      {children}
    </PWAInstallContext.Provider>
  );
}

export function usePWAInstall() {
  const ctx = useContext(PWAInstallContext);
  if (!ctx) {
    throw new Error("usePWAInstall must be used within a PWAInstallProvider");
  }
  return ctx;
}
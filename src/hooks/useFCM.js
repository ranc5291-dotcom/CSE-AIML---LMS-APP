import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { setupFCMToken, onForegroundMessage } from "../utils/firebaseMessaging";

// Simple in-app toast for foreground notifications — swap this for
// whatever toast/snackbar system you'd like later.
function showForegroundToast(title, body, onClick) {
  const el = document.createElement("div");
  el.textContent = `${title}: ${body}`;
  el.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 9999;
    background: #1f2937; color: white; padding: 12px 16px;
    border-radius: 12px; font-size: 13px; max-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: pointer;
  `;
  el.onclick = () => {
    onClick();
    el.remove();
  };
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

export function useFCM() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const setupDone = useRef(false);

  useEffect(() => {
    if (!user?.id || setupDone.current) return;
    setupDone.current = true;

    setupFCMToken(user).then((result) => {
      if (!result.success) {
        console.warn("FCM setup:", result.error);
      }
    });

    // Refresh the token periodically (FCM tokens can rotate); once per
    // app load is enough for most cases, but also re-run on tab focus.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setupFCMToken(user);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const unsubscribe = onForegroundMessage((payload) => {
      const title = payload.notification?.title || payload.data?.title || "Notification";
      const body  = payload.notification?.body  || payload.data?.body  || "";
      const url   = payload.data?.url || "/";
      showForegroundToast(title, body, () => navigate(url));
    });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubscribe();
      setupDone.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
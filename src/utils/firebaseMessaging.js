import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app, db } from "./firebase";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let messagingInstance = null;
let swRegistration = null;

// Registers the FCM-specific service worker under its own scope so it
// never conflicts with the Workbox PWA service worker at "/".
export async function registerMessagingServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  if (swRegistration) return swRegistration;

  try {
    swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/firebase-cloud-messaging-push-scope/",
    });
    return swRegistration;
  } catch (err) {
    console.warn("FCM service worker registration failed:", err);
    return null;
  }
}

function getMessagingInstance() {
  if (!messagingInstance) {
    try {
      messagingInstance = getMessaging(app);
    } catch (err) {
      console.warn("Firebase Messaging not supported in this browser:", err.message);
      return null;
    }
  }
  return messagingInstance;
}

// Requests permission, retrieves the FCM token, and saves it to Firestore
// keyed by user id + role, so the backend can query by role for targeted sends.
export async function setupFCMToken(user) {
  if (!user?.id) return { success: false, error: "No user provided." };
  if (!("Notification" in window)) return { success: false, error: "Notifications not supported." };

  try {
    // Only actually prompt if the user hasn't already decided. Re-calling
    // requestPermission() on an already-denied/granted state is what
    // triggers Chrome's "dismissed several times -> auto-block" behavior
    // when this runs repeatedly (e.g. on every tab focus).
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      return { success: false, error: `Notification permission ${permission}.` };
    }

    const registration = await registerMessagingServiceWorker();
    const messaging = getMessagingInstance();
    if (!messaging || !registration) {
      return { success: false, error: "Messaging not available on this device." };
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return { success: false, error: "Could not retrieve FCM token." };
    }

    // Store/refresh the token in Firestore. Keyed by uid so re-registering
    // (token refresh, re-login) just overwrites the same doc.
    // IMPORTANT: role must match whatever your backend queries by
    // (activeRole, not a stale/static user.role) or role-targeted sends
    // will silently find zero tokens for this user.
    await setDoc(doc(db, "fcmTokens", user.id), {
      token,
      userId: user.id,
      userName: user.name || "",
      role: user.activeRole || user.role || "",
      updatedAt: serverTimestamp(),
    });

    return { success: true, token };
  } catch (err) {
    console.warn("setupFCMToken failed:", err.message);
    return { success: false, error: err.message };
  }
}

// Call on logout so a stale token isn't left targetable after the user signs out.
export async function removeFCMToken(userId) {
  if (!userId) return;
  try {
    await deleteDoc(doc(db, "fcmTokens", userId));
  } catch (err) {
    console.warn("removeFCMToken failed:", err.message);
  }
}

// Foreground listener — fires when a push arrives while the tab is open
// and focused. Returns an unsubscribe function.
export function onForegroundMessage(callback) {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
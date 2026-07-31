// This service worker handles BACKGROUND notifications (app closed or
// tab not focused). It runs independently of your Workbox PWA service
// worker (sw.js) by registering under its own scope — see main.jsx.

importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBonXmW-JFGLQwulDCwdlMadggq6oarVJs",
  authDomain: "cseaiml-lms.firebaseapp.com",
  projectId: "cseaiml-lms",
  storageBucket: "cseaiml-lms.firebasestorage.app",
  messagingSenderId: "379189685523",
  appId: "1:379189685523:web:4dce82417f29efa8373ee6",
});

const messaging = firebase.messaging();

// Background message handler — shows the OS-level notification.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "CSEAIML LMS";
  const options = {
    body: payload.notification?.body || payload.data?.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: {
      url: payload.data?.url || "/",
    },
  };
  self.registration.showNotification(title, options);
});

// Click navigation — focuses an existing tab if open, else opens a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
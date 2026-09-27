// functions/index.js
//
// Triggers automatically whenever a document is created in the
// notificationEvents Firestore collection (written by
// src/utils/api.js's sendNotification()). Looks up matching FCM
// tokens by role/year/semester (or explicit userIds) and sends the
// push via firebase-admin.

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Matches your Firestore database location (asia-south1).
setGlobalOptions({ region: "asia-south1" });

const db = admin.firestore();

// Resolves the target FCM tokens for one notification event.
// - userIds present  → look up those specific users' tokens.
// - otherwise        → query fcmTokens by role/year/semester (AND'd
//                       together).
//   - role only            → everyone with that role (e.g. all students)
//   - role + year + sem    → only students in that exact semester
async function getTokens({ role, userIds, year, semester }) {
  const tokensRef = db.collection("fcmTokens");

  if (userIds && userIds.length > 0) {
    const snaps = await Promise.all(
      userIds.map((uid) => tokensRef.doc(uid).get())
    );
    return snaps
      .filter((d) => d.exists && d.data()?.token)
      .map((d) => d.data().token);
  }

  let q = tokensRef;
  if (role) q = q.where("role", "==", role);
  if (year) q = q.where("year", "==", year);
  if (semester) q = q.where("semester", "==", semester);

  const snap = await q.get();
  return snap.docs.filter((d) => d.data()?.token).map((d) => d.data().token);
}

exports.sendNotificationOnEvent = onDocumentCreated(
  "notificationEvents/{eventId}",
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.error("No event data received");
      return;
    }

    const eventId = event.params.eventId;
    const data = snap.data();

    logger.info("========== NOTIFICATION EVENT ==========");
    logger.info("Event ID:", eventId);
    logger.info("Event data:", data);

    const {
      title,
      body,
      url = "/",
      role = null,
      userIds = null,
      year = null,
      semester = null,
    } = data;

    logger.info("Notification target:", { role, userIds, year, semester });

    if (!title || !body) {
      logger.error("Missing title or body", { title, body });
      await snap.ref.update({
        status: "failed",
        error: "Missing title or body",
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    let tokens;
    try {
      tokens = await getTokens({ role, userIds, year, semester });
    } catch (err) {
      logger.error("Failed while finding FCM tokens", {
        error: err.message,
        stack: err.stack,
      });
      await snap.ref.update({
        status: "failed",
        error: `Token lookup failed: ${err.message}`,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    logger.info("FCM TOKENS FOUND", { count: tokens.length });

    if (tokens.length === 0) {
      logger.warn("NO FCM TOKENS MATCHED", { role, userIds, year, semester });
      await snap.ref.update({
        status: "no_recipients",
        successCount: 0,
        failureCount: 0,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // data-only payload — matches your existing service worker's
    // onBackgroundMessage handler, which builds the notification from
    // payload.data (not payload.notification), avoiding a double display.
    let response;
    try {
      response = await admin.messaging().sendEachForMulticast({
        data: {
          title: String(title),
          body: String(body),
          url: String(url || "/"),
        },
        // ── Delivery priority ──────────────────────────────────
        // Without these, FCM defaults to "normal" priority, which
        // Android/iOS can batch and delay by minutes under Doze /
        // App Standby. High priority forces immediate wake+deliver,
        // matching WhatsApp-style speed.
        android: {
          priority: "high",
        },
        apns: {
          headers: {
            "apns-priority": "10",
            "apns-push-type": "background",
          },
          payload: {
            aps: {
              "content-available": 1,
            },
          },
        },
        webpush: {
          headers: {
            Urgency: "high",
          },
        },
        tokens,
      });

      logger.info("========== FCM RESULT ==========");
      logger.info("Success count:", response.successCount);
      logger.info("Failure count:", response.failureCount);

      response.responses.forEach((result, index) => {
        if (result.success) {
          logger.info(`FCM token ${index}: SUCCESS`);
        } else {
          logger.error(`FCM token ${index}: FAILED`, {
            errorCode: result.error?.code,
            errorMessage: result.error?.message,
          });
        }
      });

      // Still not deleting failed tokens automatically — see note below.

      await snap.ref.update({
        status: "sent",
        successCount: response.successCount,
        failureCount: response.failureCount,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info("Notification event completed", {
        eventId,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
    } catch (err) {
      logger.error("FCM SEND FAILED", {
        errorCode: err.code,
        errorMessage: err.message,
        stack: err.stack,
      });
      await snap.ref.update({
        status: "failed",
        error: err.message,
        errorCode: err.code || null,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);
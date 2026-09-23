// functions/index.js
//
// Triggers automatically whenever a document is created in the
// `notificationEvents` Firestore collection (written by
// src/utils/api.js's sendNotification()). Looks up matching FCM
// tokens by role/year/semester (or explicit userIds) and sends the
// push via firebase-admin — same logic as the old FastAPI
// /notifications/send route, just triggered by Firestore instead of
// an HTTP call to Render.

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

// Matches your Firestore database location (asia-south1).
setGlobalOptions({ region: "asia-south1" });

const db = admin.firestore();

// Resolves the target FCM tokens for one notification event.
// - userIds present  → look up those specific users' tokens.
// - otherwise        → query fcmTokens by role/year/semester (AND'd
//                       together), same as the old Python _get_tokens().
//   - role only            → everyone with that role (e.g. all students)
//   - role + year + sem    → only students in that exact semester
async function getTokens({ role, userIds, year, semester }) {
  const tokensRef = db.collection("fcmTokens");

  if (userIds && userIds.length > 0) {
    const snaps = await Promise.all(userIds.map((uid) => tokensRef.doc(uid).get()));
    return snaps
      .filter((d) => d.exists && d.data().token)
      .map((d) => d.data().token);
  }

  let q = tokensRef;
  if (role) q = q.where("role", "==", role);
  if (year) q = q.where("year", "==", year);
  if (semester) q = q.where("semester", "==", semester);

  const snap = await q.get();
  return snap.docs.filter((d) => d.data().token).map((d) => d.data().token);
}

exports.sendNotificationOnEvent = onDocumentCreated(
  "notificationEvents/{eventId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const {
      title,
      body,
      url = "/",
      role = null,
      userIds = null,
      year = null,
      semester = null,
    } = data;

    if (!title || !body) {
      await snap.ref.update({ status: "failed", error: "Missing title or body" });
      return;
    }

    const tokens = await getTokens({ role, userIds, year, semester });

    if (tokens.length === 0) {
      await snap.ref.update({
        status: "no_recipients",
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
          title,
          body,
          url: url || "/",
        },
        tokens,
      });
    } catch (err) {
      await snap.ref.update({ status: "failed", error: err.message });
      return;
    }

    // Clean up dead/invalid tokens, same as the old Python route did.
    if (response.failureCount > 0) {
      await Promise.all(
        response.responses.map(async (r, idx) => {
          if (!r.success) {
            const badToken = tokens[idx];
            const dead = await db.collection("fcmTokens").where("token", "==", badToken).get();
            const batch = db.batch();
            dead.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        })
      );
    }

    await snap.ref.update({
      status: "sent",
      successCount: response.successCount,
      failureCount: response.failureCount,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);
import { db } from "./firebase";
import {
  doc, deleteDoc, collection, query, where, getDocs, updateDoc, arrayRemove,
} from "firebase/firestore";

// Docs keyed DIRECTLY by uid (the doc ID itself is the user's id) — a plain
// deleteDoc is safe here since there's no way to hit another user's doc.
const DIRECT_DOC_COLLECTIONS = ["attendance", "marks", "fcmTokens"];

// Collections where ownership is a queryable field rather than the doc id.
const QUERY_OWNED = [
  { collection: "promotions", field: "studentId" },
];

// Collections where the user is only REFERENCED inside a shared document
// (e.g. joined an event) — remove the reference, never delete the doc.
const REFERENCE_ONLY = [
  { collection: "events", field: "joined" },
];

// NOTE: notes / assignments / gallery / placementUploads / markSheetUploads /
// announcements / notices / complaints are intentionally NOT included here.
// In the current schema they store `uploadedBy` / `postedBy` as a display
// NAME string, not a uid, so there is no safe way to match them to the
// authenticated user without risking either deleting nothing or deleting
// the wrong thing. Add a `uid` field to those docs going forward if you
// want them covered by this flow.

export async function clearFirestoreUserData(uid) {
  const errors = [];

  for (const col of DIRECT_DOC_COLLECTIONS) {
    try {
      await deleteDoc(doc(db, col, uid));
    } catch (e) {
      errors.push(`${col}: ${e.message}`);
    }
  }

  for (const { collection: col, field } of QUERY_OWNED) {
    try {
      const snap = await getDocs(query(collection(db, col), where(field, "==", uid)));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    } catch (e) {
      errors.push(`${col}: ${e.message}`);
    }
  }

  for (const { collection: col, field } of REFERENCE_ONLY) {
    try {
      const snap = await getDocs(query(collection(db, col), where(field, "array-contains", uid)));
      await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { [field]: arrayRemove(uid) })));
    } catch (e) {
      errors.push(`${col}: ${e.message}`);
    }
  }

  if (errors.length > 0) throw new Error(errors.join(" | "));
}
from datetime import timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from firebase_admin import messaging, firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from firebase_admin_init import get_firebase_app

router = APIRouter(prefix="/notifications", tags=["Notifications"])

get_firebase_app()
fs_client = firestore.client()

# FCM allows at most 500 tokens per multicast call.
MAX_BATCH = 500
# If a device can't be reached within this window, drop the push instead of
# delivering it hours late.
PUSH_TTL_SECONDS = 3600


class NotificationCreate(BaseModel):
    title: str
    body: str
    url: Optional[str] = "/"
    role: Optional[str] = None
    userIds: Optional[List[str]] = None
    year: Optional[str] = None
    semester: Optional[str] = None


def _norm(v) -> str:
    """Normalise a value for comparison: trim, collapse spaces, lowercase."""
    return " ".join(str(v or "").split()).lower()


def _get_tokens(role: Optional[str], user_ids: Optional[List[str]],
                year: Optional[str] = None, semester: Optional[str] = None) -> List[str]:
    tokens_ref = fs_client.collection("fcmTokens")

    # ── Targeted by specific user ids ────────────────────────────
    if user_ids:
        # One round trip instead of one .get() per user.
        refs = [tokens_ref.document(uid) for uid in user_ids]
        docs = fs_client.get_all(refs)
        tokens = []
        for d in docs:
            if d.exists:
                token = (d.to_dict() or {}).get("token")
                if token:
                    tokens.append(token)
        print(f"[notifications] userIds={len(user_ids)} matched={len(tokens)}")
        return list(dict.fromkeys(tokens))  # de-duplicate, keep order

    # ── Targeted by role (+ optional semester) ───────────────────
    # We filter by role in Firestore, then match the semester in Python.
    # This tolerates old token docs that still store "sem" instead of
    # "semester", and stray spaces / casing differences.
    # `year` is intentionally not checked: the semester already implies it,
    # and year was the most fragile field to match.
    query = tokens_ref
    if role:
        query = query.where(filter=FieldFilter("role", "==", role))

    tokens = []
    scanned = 0
    for d in query.stream():
        scanned += 1
        data = d.to_dict() or {}

        sem_val = data.get("semester") or data.get("sem")
        if semester and _norm(sem_val) != _norm(semester):
            continue

        token = data.get("token")
        if token:
            tokens.append(token)

    print(
        f"[notifications] role={role!r} year={year!r} semester={semester!r} "
        f"scanned={scanned} matched={len(tokens)}"
    )
    return list(dict.fromkeys(tokens))  # de-duplicate, keep order


@router.post("/send")
def send_notification(data: NotificationCreate):
    tokens = _get_tokens(data.role, data.userIds, data.year, data.semester)

    if not tokens:
        raise HTTPException(404, "No registered devices found for the given target.")

    # data-only payload: FCM auto-displays a system notification when a
    # top-level `notification` field is present, which duplicates the one
    # our own onBackgroundMessage/onForegroundMessage handlers already show.
    # Sending everything under `data` keeps display fully in our control.
    #
    # Priority/urgency + TTL are what make delivery fast. Without them FCM
    # treats the message as normal priority and may defer it for hours.
    payload = {
        "title": data.title,
        "body": data.body,
        "url": data.url or "/",
    }
    webpush_config = messaging.WebpushConfig(
        headers={"Urgency": "high", "TTL": str(PUSH_TTL_SECONDS)},
    )
    android_config = messaging.AndroidConfig(
        priority="high",
        ttl=timedelta(seconds=PUSH_TTL_SECONDS),
    )

    success_count = 0
    failure_count = 0
    dead_tokens: List[str] = []

    for start in range(0, len(tokens), MAX_BATCH):
        batch_tokens = tokens[start:start + MAX_BATCH]
        message = messaging.MulticastMessage(
            data=payload,
            tokens=batch_tokens,
            webpush=webpush_config,
            android=android_config,
        )

        try:
            response = messaging.send_each_for_multicast(message)
        except Exception as e:
            raise HTTPException(500, f"Failed to send notifications: {str(e)}")

        success_count += response.success_count
        failure_count += response.failure_count

        # Only remove tokens FCM says are permanently invalid. Temporary
        # failures must not delete a working device's token.
        for idx, resp in enumerate(response.responses):
            if not resp.success:
                print(f"[notifications] send failed: {type(resp.exception).__name__}: {resp.exception}")
                if isinstance(resp.exception, messaging.UnregisteredError):
                    dead_tokens.append(batch_tokens[idx])

    for bad_token in dead_tokens:
        docs = (
            fs_client.collection("fcmTokens")
            .where(filter=FieldFilter("token", "==", bad_token))
            .stream()
        )
        for d in docs:
            d.reference.delete()

    print(
        f"[notifications] done success={success_count} "
        f"failure={failure_count} targeted={len(tokens)}"
    )

    return {
        "success_count": success_count,
        "failure_count": failure_count,
        "total_targeted": len(tokens),
    }
from datetime import timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from firebase_admin import messaging, firestore

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


def _get_tokens(role: Optional[str], user_ids: Optional[List[str]],
                 year: Optional[str] = None, semester: Optional[str] = None) -> List[str]:
    tokens_ref = fs_client.collection("fcmTokens")

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
        return list(dict.fromkeys(tokens))  # de-duplicate, keep order

    query = tokens_ref
    if role:
        query = query.where("role", "==", role)
    if year:
        query = query.where("year", "==", year)
    if semester:
        query = query.where("semester", "==", semester)

    tokens = []
    for d in query.stream():
        token = (d.to_dict() or {}).get("token")
        if token:
            tokens.append(token)
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
            if not resp.success and isinstance(resp.exception, messaging.UnregisteredError):
                dead_tokens.append(batch_tokens[idx])

    for bad_token in dead_tokens:
        docs = fs_client.collection("fcmTokens").where("token", "==", bad_token).stream()
        for d in docs:
            d.reference.delete()

    return {
        "success_count": success_count,
        "failure_count": failure_count,
        "total_targeted": len(tokens),
    }
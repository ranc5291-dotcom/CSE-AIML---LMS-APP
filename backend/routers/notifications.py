from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from firebase_admin import messaging, firestore

from firebase_admin_init import get_firebase_app

router = APIRouter(prefix="/notifications", tags=["Notifications"])

get_firebase_app()  # ensure initialized before any messaging calls
fs_client = firestore.client()


class NotificationCreate(BaseModel):
    title: str
    body: str
    url: Optional[str] = "/"
    role: Optional[str] = None       # "student" | "faculty" | "placement" | "admin" | None (= everyone)
    userIds: Optional[List[str]] = None  # target specific users instead of a whole role


def _get_tokens(role: Optional[str], user_ids: Optional[List[str]]) -> List[str]:
    tokens_ref = fs_client.collection("fcmTokens")

    if user_ids:
        docs = [tokens_ref.document(uid).get() for uid in user_ids]
        return [d.to_dict()["token"] for d in docs if d.exists and d.to_dict().get("token")]

    query = tokens_ref
    if role:
        query = query.where("role", "==", role)

    docs = query.stream()
    return [d.to_dict()["token"] for d in docs if d.to_dict().get("token")]


@router.post("/send")
async def send_notification(data: NotificationCreate):
    tokens = _get_tokens(data.role, data.userIds)

    if not tokens:
        raise HTTPException(404, "No registered devices found for the given target.")

    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=data.title, body=data.body),
        data={"url": data.url or "/"},
        tokens=tokens,
    )

    try:
        response = messaging.send_each_for_multicast(message)
    except Exception as e:
        raise HTTPException(500, f"Failed to send notifications: {str(e)}")

    # Clean up dead tokens (uninstalled app / revoked permission) so future
    # sends don't keep failing against them.
    if response.failure_count > 0:
        for idx, resp in enumerate(response.responses):
            if not resp.success:
                bad_token = tokens[idx]
                docs = fs_client.collection("fcmTokens").where("token", "==", bad_token).stream()
                for d in docs:
                    d.reference.delete()

    return {
        "success_count": response.success_count,
        "failure_count": response.failure_count,
        "total_targeted": len(tokens),
    }
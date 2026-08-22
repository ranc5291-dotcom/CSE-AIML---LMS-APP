from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from firebase_admin import messaging, firestore

from firebase_admin_init import get_firebase_app

router = APIRouter(prefix="/notifications", tags=["Notifications"])

get_firebase_app()
fs_client = firestore.client()


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
        docs = [tokens_ref.document(uid).get() for uid in user_ids]
        return [d.to_dict()["token"] for d in docs if d.exists and d.to_dict().get("token")]

    query = tokens_ref
    if role:
        query = query.where("role", "==", role)
    if year:
        query = query.where("year", "==", year)
    if semester:
        query = query.where("semester", "==", semester)

    docs = query.stream()
    return [d.to_dict()["token"] for d in docs if d.to_dict().get("token")]


@router.post("/send")
async def send_notification(data: NotificationCreate):
    tokens = _get_tokens(data.role, data.userIds, data.year, data.semester)

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
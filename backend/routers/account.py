from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from firebase_admin import auth as firebase_auth
from firebase_admin_setup import get_firebase_app

router = APIRouter(prefix="/account", tags=["account"])


class DeleteAccountRequest(BaseModel):
    # The Supabase profiles.id for the account being cleared — this is the
    # same value as the Firebase UID created at registration. Sent
    # separately from the token's own uid because a phone-OTP login
    # authenticates under a different Firebase identity than the original
    # email/password account tied to this profile.
    profile_uid: str


def _verify_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")

    id_token = authorization.split(" ", 1)[1]
    try:
        decoded = firebase_auth.verify_id_token(id_token, app=get_firebase_app())
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired session: {str(e)}")

    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Token did not contain a valid uid.")
    return uid


def _delete_firebase_user(uid: str):
    try:
        firebase_auth.delete_user(uid, app=get_firebase_app())
    except firebase_auth.UserNotFoundError:
        # Already gone — treat as success so this endpoint is safely
        # retryable and idempotent.
        pass


@router.delete("/delete-account")
async def delete_account(payload: DeleteAccountRequest, authorization: str = Header(None)):
    """
    Deletes the Firebase Auth account(s) for the current user. Requires a
    valid Firebase ID token proving the caller is currently signed in —
    this does NOT let a client delete an arbitrary uid without an active
    session, but note it does not re-verify the account password (Firebase
    Admin SDK deletion doesn't require it). Frontend must only call this
    right after the person explicitly confirms account deletion.
    """
    token_uid = _verify_token(authorization)

    _delete_firebase_user(token_uid)

    # Also delete the original registration account if this session's
    # Firebase identity differs from it (phone-OTP login case).
    if payload.profile_uid and payload.profile_uid != token_uid:
        _delete_firebase_user(payload.profile_uid)

    return {"success": True, "deleted_uids": list({token_uid, payload.profile_uid})}
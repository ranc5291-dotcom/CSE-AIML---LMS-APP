import asyncio
import hashlib
import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, HTTPException
from firebase_admin import firestore, firestore_async
from pydantic import BaseModel, EmailStr

from firebase_admin_init import get_firebase_app

router = APIRouter(prefix="/auth/email-otp", tags=["Email OTP"])

# uvicorn's logger so the timing lines always show up in your server logs
logger = logging.getLogger("uvicorn.error")

# Make sure the Firebase app is initialised (same as before).
get_firebase_app()

OTP_TTL_MINUTES = 10
MAX_ATTEMPTS = 5

BREVO_API_KEY = os.getenv("BREVO_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreplycseaimlms@gmail.com")
FROM_NAME = os.getenv("FROM_NAME", "CSEAIML LMS")
BREVO_URL = "https://api.brevo.com/v3/smtp/email"

# ---------------------------------------------------------------------------
# Shared async clients, created lazily on first request (inside the running
# event loop). Everything below is fully async: while one request is waiting
# on Firestore or Brevo, the server keeps handling other students' requests,
# so 100 people tapping "Send OTP" together don't queue behind each other.
# ---------------------------------------------------------------------------
_db = None
_http: httpx.AsyncClient | None = None


def _get_db():
    global _db
    if _db is None:
        _db = firestore_async.client()
    return _db


def _get_http() -> httpx.AsyncClient:
    global _http
    if _http is None:
        _http = httpx.AsyncClient(
            timeout=httpx.Timeout(8.0, connect=3.0),
            limits=httpx.Limits(max_connections=200, max_keepalive_connections=20),
        )
    return _http


class SendOtpRequest(BaseModel):
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


async def _send_email(to_email: str, otp: str) -> str | None:
    """Send the OTP via Brevo. Returns Brevo's messageId (searchable in Brevo > Logs)."""
    if not BREVO_API_KEY:
        raise HTTPException(500, "Email service not configured on the server (missing BREVO_API_KEY).")

    payload = {
        "sender": {"name": FROM_NAME, "email": FROM_EMAIL},
        "to": [{"email": to_email}],
        "subject": "Your CSEAIML LMS verification code",
        "textContent": (
            f"Your CSEAIML LMS verification code is: {otp}\n\n"
            f"This code expires in {OTP_TTL_MINUTES} minutes. "
            f"If you did not request this, you can safely ignore this email."
        ),
    }
    headers = {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    resp = None
    # One quick retry for transient problems (network blip, Brevo busy / 5xx),
    # which are the failures you're most likely to see under heavy load.
    for attempt in (1, 2):
        try:
            resp = await _get_http().post(BREVO_URL, headers=headers, json=payload)
        except httpx.HTTPError as exc:
            logger.warning("[email-otp] Brevo request failed (attempt %d): %s", attempt, exc)
            resp = None
        else:
            if resp.status_code < 400:
                break
            if resp.status_code != 429 and resp.status_code < 500:
                break  # a real error (bad key, bad sender...) - retrying won't help
            logger.warning("[email-otp] Brevo returned %s (attempt %d)", resp.status_code, attempt)

        if attempt == 1:
            await asyncio.sleep(0.5)

    if resp is None:
        raise HTTPException(502, "Could not reach the email service. Please try again.")

    if resp.status_code >= 400:
        logger.error("[email-otp] Brevo error %s: %s", resp.status_code, resp.text)
        raise HTTPException(500, f"Failed to send email: {resp.text}")

    try:
        return resp.json().get("messageId")
    except ValueError:
        return None


@router.post("/send")
async def send_email_otp(data: SendOtpRequest):
    t0 = time.perf_counter()

    email = data.email.lower().strip()
    otp = f"{secrets.randbelow(1_000_000):06d}"

    doc_ref = _get_db().collection("emailOtps").document(email)
    await doc_ref.set({
        "otpHash":   _hash_otp(otp),
        "expiresAt": datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
        "attempts":  0,
        "verified":  False,
        "createdAt": firestore.SERVER_TIMESTAMP,
    })
    t1 = time.perf_counter()

    message_id = await _send_email(email, otp)
    t2 = time.perf_counter()

    logger.info(
        "[email-otp] firestore write %.2fs | brevo send %.2fs | total %.2fs | messageId=%s",
        t1 - t0, t2 - t1, t2 - t0, message_id,
    )

    return {"success": True, "message": "OTP sent to your email."}


@router.post("/verify")
async def verify_email_otp(data: VerifyOtpRequest):
    email = data.email.lower().strip()
    doc_ref = _get_db().collection("emailOtps").document(email)
    snap = await doc_ref.get()

    if not snap.exists:
        raise HTTPException(400, "No OTP was requested for this email. Please request a new one.")

    record = snap.to_dict()

    if record.get("attempts", 0) >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many incorrect attempts. Please request a new OTP.")

    expires_at = record.get("expiresAt")
    if expires_at and datetime.now(timezone.utc) > expires_at:
        raise HTTPException(400, "OTP expired. Please request a new one.")

    if _hash_otp(data.otp.strip()) != record.get("otpHash"):
        await doc_ref.update({"attempts": firestore.Increment(1)})
        raise HTTPException(400, "Incorrect OTP.")

    await doc_ref.update({"verified": True})
    return {"success": True, "verified": True}
import random
import hashlib
import os
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from firebase_admin import firestore
from firebase_admin_init import get_firebase_app

router = APIRouter(prefix="/auth/email-otp", tags=["Email OTP"])

get_firebase_app()
fs_client = firestore.client()

OTP_TTL_MINUTES = 10
MAX_ATTEMPTS = 5

SMTP_HOST  = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT  = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER  = os.getenv("SMTP_USER")
SMTP_PASS  = os.getenv("SMTP_PASS")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)
FROM_NAME  = os.getenv("FROM_NAME", "CSEAIML LMS")


class SendOtpRequest(BaseModel):
    email: EmailStr

class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


def _send_email(to_email: str, otp: str):
    if not SMTP_USER or not SMTP_PASS:
        raise HTTPException(500, "Email service not configured on the server (missing SMTP_USER/SMTP_PASS).")
    body = (
        f"Your CSEAIML LMS verification code is: {otp}\n\n"
        f"This code expires in {OTP_TTL_MINUTES} minutes. "
        f"If you did not request this, you can safely ignore this email."
    )
    msg = MIMEText(body)
    msg["Subject"] = "Your CSEAIML LMS verification code"
    msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg["To"] = to_email
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(FROM_EMAIL, [to_email], msg.as_string())


@router.post("/send")
async def send_email_otp(data: SendOtpRequest):
    email = data.email.lower().strip()
    otp = f"{random.randint(0, 999999):06d}"

    doc_ref = fs_client.collection("emailOtps").document(email)
    doc_ref.set({
        "otpHash":   _hash_otp(otp),
        "expiresAt": datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
        "attempts":  0,
        "verified":  False,
        "createdAt": firestore.SERVER_TIMESTAMP,
    })

    try:
        _send_email(email, otp)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to send email: {str(e)}")

    return {"success": True, "message": "OTP sent to your email."}


@router.post("/verify")
async def verify_email_otp(data: VerifyOtpRequest):
    email = data.email.lower().strip()
    doc_ref = fs_client.collection("emailOtps").document(email)
    snap = doc_ref.get()

    if not snap.exists:
        raise HTTPException(400, "No OTP was requested for this email. Please request a new one.")

    record = snap.to_dict()

    if record.get("attempts", 0) >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many incorrect attempts. Please request a new OTP.")

    expires_at = record.get("expiresAt")
    if expires_at and datetime.now(timezone.utc) > expires_at:
        raise HTTPException(400, "OTP expired. Please request a new one.")

    if _hash_otp(data.otp.strip()) != record.get("otpHash"):
        doc_ref.update({"attempts": firestore.Increment(1)})
        raise HTTPException(400, "Incorrect OTP.")

    doc_ref.update({"verified": True})
    return {"success": True, "verified": True}
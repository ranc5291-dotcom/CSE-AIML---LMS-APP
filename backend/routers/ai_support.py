"""
routers/ai_support.py

AI support assistant endpoint for the Help & Support tab.
Enforces a 3-questions-per-4.5-hour limit per user via a Supabase RPC,
then answers using Groq, grounded strictly in lms_knowledge.py.

Auth: verifies the Firebase ID token sent by the frontend (getIdToken()),
the same way /account/delete-account does. Uses the firebase_admin app
already initialized in firebase_admin_init.py -- does NOT initialize a
second Firebase Admin app.

Install: pip install groq supabase
Env vars needed: GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
(FIREBASE_SERVICE_ACCOUNT_PATH already exists in your .env)
"""

import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from firebase_admin import auth as firebase_auth
from groq import Groq

from lms_knowledge import LMS_KNOWLEDGE_BASE, SYSTEM_PROMPT_TEMPLATE
from supabase_client import supabase
from firebase_admin_init import get_firebase_app

router = APIRouter(prefix="/api/ai-support", tags=["ai-support"])

groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])

QUESTION_LIMIT = 3
WINDOW_HOURS = 4.5
MODEL = "openai/gpt-oss-20b"

# Make sure the shared Firebase Admin app is initialized before any
# verify_id_token() call below. get_firebase_app() is idempotent (it
# only initializes once, globally), so this is safe even if
# notifications.py / account.py already called it.
get_firebase_app()


def get_current_user_id(authorization: str = Header(None)) -> str:
    """Verifies the Firebase ID token the frontend sends via getIdToken()."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")

    token = authorization.split(" ", 1)[1]
    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    user_id = decoded.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload.")
    return user_id


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)


class AskResponse(BaseModel):
    answer: str
    remaining: int
    reset_at: str


def _check_usage_only(user_id: str):
    """Read-only version of the usage check (mirrors /status). Does NOT
    increment anything -- used to reject over-limit requests BEFORE we
    spend a Groq call, so a failed Groq call never costs the user a
    question."""
    result = supabase.table("ai_support_usage").select("*").eq("user_id", user_id).execute()
    if not result.data:
        return  # no row yet -> definitely under the limit

    row = result.data[0]
    window = timedelta(hours=WINDOW_HOURS)
    window_start = datetime.fromisoformat(row["window_start"].replace("Z", "+00:00"))

    if datetime.now(timezone.utc) - window_start > window:
        return  # window expired -> fresh set of questions

    if row["question_count"] >= QUESTION_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "message": "You've used all 3 questions for now. Try again later.",
                "reset_at": (window_start + window).isoformat(),
            },
        )


@router.post("/ask", response_model=AskResponse)
async def ask_ai_support(payload: AskRequest, user_id: str = Depends(get_current_user_id)):
    # 1. Reject over-limit requests WITHOUT spending a question.
    _check_usage_only(user_id)

    # 2. Call Groq. If this fails, the user hasn't been charged anything.
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(knowledge_base=LMS_KNOWLEDGE_BASE)
    try:
        completion = groq_client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": payload.question},
            ],
            temperature=0.3,
            max_tokens=300,
        )
        answer = completion.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    # 3. Only now, after a real answer came back, spend one of the 3 questions.
    result = supabase.rpc(
        "check_and_increment_ai_usage",
        {
            "p_user_id": user_id,
            "p_limit": QUESTION_LIMIT,
            "p_window_hours": WINDOW_HOURS,
        },
    ).execute()
    row = result.data[0]

    return AskResponse(answer=answer, remaining=row["remaining"], reset_at=row["reset_at"])


@router.get("/status")
async def get_ai_support_status(user_id: str = Depends(get_current_user_id)):
    """Remaining questions + the time the window resets, without spending one."""
    result = supabase.table("ai_support_usage").select("*").eq("user_id", user_id).execute()
    if not result.data:
        return {"remaining": QUESTION_LIMIT, "reset_at": None}

    row = result.data[0]
    window = timedelta(hours=WINDOW_HOURS)
    window_start = datetime.fromisoformat(row["window_start"].replace("Z", "+00:00"))

    # Window already expired -> user has a fresh set of questions
    if datetime.now(timezone.utc) - window_start > window:
        return {"remaining": QUESTION_LIMIT, "reset_at": None}

    return {
        "remaining": max(0, QUESTION_LIMIT - row["question_count"]),
        "reset_at": (window_start + window).isoformat(),
    }
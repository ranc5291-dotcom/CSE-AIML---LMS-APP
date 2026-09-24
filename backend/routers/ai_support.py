"""
routers/ai_support.py

AI support assistant endpoint for the Help & Support tab.
Enforces a 3-questions-per-4.5-hour limit per user via a Supabase RPC,
then answers using Groq, grounded strictly in lms_knowledge.py.

Auth: decodes your existing custom JWT (same SECRET_KEY/ALGORITHM as
auth.py) to get the user id from the "sub" claim -- there's no separate
Supabase Auth user here.

Install: pip install groq supabase
Env vars needed: GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
(SECRET_KEY / ALGORITHM already exist in your .env for auth.py)
"""

import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from jose import jwt, JWTError
from groq import Groq

from lms_knowledge import LMS_KNOWLEDGE_BASE, SYSTEM_PROMPT_TEMPLATE
from supabase_client import supabase

router = APIRouter(prefix="/api/ai-support", tags=["ai-support"])

groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])

SECRET_KEY = os.getenv("SECRET_KEY", "changeme")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

QUESTION_LIMIT = 3
WINDOW_HOURS = 4.5
MODEL = "llama-3.1-8b-instant"


def get_current_user_id(authorization: str = Header(None)) -> str:
    """Decodes the same JWT your other routes use (see auth.py's create_token)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload.")
    return user_id


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)


class AskResponse(BaseModel):
    answer: str
    remaining: int
    reset_at: str


@router.post("/ask", response_model=AskResponse)
async def ask_ai_support(payload: AskRequest, user_id: str = Depends(get_current_user_id)):
    result = supabase.rpc(
        "check_and_increment_ai_usage",
        {
            "p_user_id": user_id,
            "p_limit": QUESTION_LIMIT,
            "p_window_hours": WINDOW_HOURS,
        },
    ).execute()

    row = result.data[0]
    if not row["allowed"]:
        raise HTTPException(
            status_code=429,
            detail={
                "message": "You've used all 3 questions for now. Try again later.",
                "reset_at": row["reset_at"],
            },
        )

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
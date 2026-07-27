from fastapi import APIRouter, HTTPException, status
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from bson import ObjectId
import os
from dotenv import load_dotenv

from database import users_col
from models import (
    RegisterStudent, RegisterStaff,
    LoginRequest, TokenResponse,
    ForgotPasswordRequest, ResetPasswordRequest,
)

load_dotenv()

router     = APIRouter(prefix="/auth", tags=["Auth"])
pwd_ctx    = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "changeme")
ALGORITHM  = os.getenv("ALGORITHM", "HS256")
EXPIRE_MIN = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080))


def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=EXPIRE_MIN)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def user_to_dict(user: dict) -> dict:
    user["id"] = str(user["_id"])
    del user["_id"]
    del user["password"]
    return user


# ── REGISTER STUDENT ──────────────────────────────────────────
@router.post("/register/student", status_code=201)
async def register_student(data: RegisterStudent):
    # Check duplicate
    existing = await users_col.find_one({
        "$or": [
            {"email": data.email},
            {"usn": data.usn.upper()},
        ]
    })
    if existing:
        raise HTTPException(400, "A user with this email or USN already exists.")

    end_year = str(int(data.startYear) + 4)
    student = {
        "name":        data.name,
        "usn":         data.usn.upper(),
        "email":       data.email.lower(),
        "phone":       data.phone or "",
        "password":    hash_password(data.password),
        "role":        "student",
        "branch":      data.branch,
        "year":        data.year,
        "sem":         data.sem,
        "startYear":   data.startYear,
        "endYear":     end_year,
        "enrolledAt":  datetime.utcnow().isoformat(),
    }
    result = await users_col.insert_one(student)
    student["id"] = str(result.inserted_id)
    del student["_id"]
    del student["password"]

    token = create_token({"sub": student["id"], "role": "student"})
    return {"access_token": token, "token_type": "bearer", "user": student}


# ── REGISTER STAFF (faculty / placement / admin) ──────────────
@router.post("/register/staff", status_code=201)
async def register_staff(data: RegisterStaff):
    existing = await users_col.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered.")

    staff = {
        "name":     data.name,
        "email":    data.email.lower(),
        "phone":    data.phone or "",
        "password": hash_password(data.password),
        "role":     data.role,
        "subject":  data.subject or "",
        "dept":     data.dept or "CSEAIML",
        "createdAt": datetime.utcnow().isoformat(),
    }
    result = await users_col.insert_one(staff)
    staff["id"] = str(result.inserted_id)
    del staff["_id"]
    del staff["password"]

    token = create_token({"sub": staff["id"], "role": data.role})
    return {"access_token": token, "token_type": "bearer", "user": staff}


# ── LOGIN ─────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    # Find by email or USN
    user = await users_col.find_one({
        "$and": [
            {"role": data.role},
            {"$or": [
                {"email": data.email.lower()},
                {"usn": data.email.upper()},   # students can login with USN
            ]}
        ]
    })
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please try again."
        )

    user_data = user_to_dict(user)
    token = create_token({"sub": user_data["id"], "role": user_data["role"]})
    return {"access_token": token, "token_type": "bearer", "user": user_data}


# ── FORGOT PASSWORD ───────────────────────────────────────────
@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    user = await users_col.find_one({"email": data.email.lower()})
    if not user:
        # Don't reveal if email exists (security best practice)
        return {"message": "If this email is registered, a reset link has been sent."}

    # Create a short-lived reset token (15 min)
    reset_token = create_token({
        "sub":     str(user["_id"]),
        "purpose": "reset",
        "exp_min": 15,
    })

    # TODO: Send email with reset link
    # reset_link = f"http://localhost:5173/reset-password?token={reset_token}"
    # send_email(data.email, reset_link)
    # For now, return token directly (remove in production!)
    print(f"[DEV] Reset token for {data.email}: {reset_token}")

    return {
        "message": "If this email is registered, a reset link has been sent.",
        "dev_token": reset_token,  # REMOVE IN PRODUCTION
    }


# ── RESET PASSWORD ────────────────────────────────────────────
@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    try:
        payload = jwt.decode(data.token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "reset":
            raise HTTPException(400, "Invalid reset token.")
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(400, "Invalid or expired reset token.")

    new_hashed = hash_password(data.new_password)
    result = await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password": new_hashed}}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "User not found.")

    return {"message": "Password reset successfully. You can now log in."}


# ── GET ALL STUDENTS (admin only) ─────────────────────────────
@router.get("/students")
async def get_all_students():
    students = []
    async for s in users_col.find({"role": "student"}):
        s["id"] = str(s["_id"])
        del s["_id"]
        del s["password"]
        students.append(s)
    return students


# ── GET ALL USERS (admin only) ────────────────────────────────
@router.get("/users")
async def get_all_users():
    users = []
    async for u in users_col.find():
        u["id"] = str(u["_id"])
        del u["_id"]
        del u["password"]
        users.append(u)
    return users
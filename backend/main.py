from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.notifications import router as notifications_router
from routers.auth import router as auth_router
from routers.notes import router as notes_router
from routers.assignments import router as assignments_router
from routers.attendance_marks import attendance_router, marks_router
from routers.email_otp import router as email_otp_router 
from routers.other_routers import (
    complaints_router,
    announcements_router,
    events_router,
    companies_router,
)

app = FastAPI(
    title       = "CSEAIML LMS API",
    description = "Backend for CSEAIML Learning Management System",
    version     = "1.0.0",
)

# ── CORS (allow React frontend) ───────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins     = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://cse-aiml-lms-app.vercel.app",  # <-- replace with your EXACT Vercel domain
    ],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── ROUTERS ───────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(email_otp_router)  
app.include_router(notes_router)
app.include_router(assignments_router)
app.include_router(attendance_router)
app.include_router(marks_router)
app.include_router(complaints_router)
app.include_router(notifications_router)
app.include_router(announcements_router)
app.include_router(events_router)
app.include_router(companies_router)


# ── HEALTH CHECK ──────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "status":  "running",
        "app":     "CSEAIML LMS API",
        "version": "1.0.0",
        "docs":    "/docs",
    }

@app.get("/health")
async def health():
    return {"status": "ok"}


# ── RUN ───────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
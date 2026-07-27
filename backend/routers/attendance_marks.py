from fastapi import APIRouter, HTTPException
from database import attendance_col, marks_col
from models import AttendanceUpdate, MarksUpdate
from bson import ObjectId

# ── ATTENDANCE ────────────────────────────────────────────────
attendance_router = APIRouter(prefix="/attendance", tags=["Attendance"])

@attendance_router.post("/update")
async def update_attendance(data: AttendanceUpdate):
    await attendance_col.update_one(
        {"studentId": data.studentId, "subject": data.subject, "sem": data.sem},
        {"$set": {
            "value":       data.value,
            "studentName": data.studentName,
            "sem":         data.sem,
        }},
        upsert=True,
    )
    return {"message": "Attendance updated."}

@attendance_router.get("/{student_id}")
async def get_student_attendance(student_id: str):
    result = {}
    async for doc in attendance_col.find({"studentId": student_id}):
        result[doc["subject"]] = doc["value"]
    return result

@attendance_router.get("/sem/{sem}")
async def get_sem_attendance(sem: str):
    result = {}
    async for doc in attendance_col.find({"sem": sem}):
        sid = doc["studentId"]
        if sid not in result:
            result[sid] = {}
        result[sid][doc["subject"]] = doc["value"]
    return result


# ── MARKS ─────────────────────────────────────────────────────
marks_router = APIRouter(prefix="/marks", tags=["Marks"])

@marks_router.post("/update")
async def update_mark(data: MarksUpdate):
    await marks_col.update_one(
        {"studentId": data.studentId, "subject": data.subject, "sem": data.sem},
        {"$set": {
            "value":       data.value,
            "studentName": data.studentName,
            "sem":         data.sem,
        }},
        upsert=True,
    )
    return {"message": "Mark updated."}

@marks_router.get("/{student_id}")
async def get_student_marks(student_id: str):
    result = {}
    async for doc in marks_col.find({"studentId": student_id}):
        result[doc["subject"]] = doc["value"]
    return result

@marks_router.get("/sem/{sem}")
async def get_sem_marks(sem: str):
    result = {}
    async for doc in marks_col.find({"sem": sem}):
        sid = doc["studentId"]
        if sid not in result:
            result[sid] = {}
        result[sid][doc["subject"]] = doc["value"]
    return result
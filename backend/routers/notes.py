from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from datetime import datetime
from bson import ObjectId
import cloudinary
import cloudinary.uploader
import os
from dotenv import load_dotenv

from database import notes_col

load_dotenv()

cloudinary.config(
    cloud_name  = os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key     = os.getenv("CLOUDINARY_API_KEY"),
    api_secret  = os.getenv("CLOUDINARY_API_SECRET"),
)

router = APIRouter(prefix="/notes", tags=["Notes"])


# ── UPLOAD NOTE ───────────────────────────────────────────────
@router.post("/upload", status_code=201)
async def upload_note(
    file:        UploadFile = File(...),
    subject:     str = Form(...),
    type:        str = Form(...),
    sem:         str = Form(...),
    uploadedBy:  str = Form(...),
):
    # Read file bytes
    file_bytes = await file.read()

    # Upload to Cloudinary
    try:
        upload_result = cloudinary.uploader.upload(
            file_bytes,
            folder       = f"cseaiml_lms/notes/{sem}",
            resource_type = "auto",        # handles PDF, image, etc.
            public_id    = f"{sem}_{subject}_{datetime.utcnow().timestamp()}",
        )
        file_url = upload_result["secure_url"]
    except Exception as e:
        raise HTTPException(500, f"File upload failed: {str(e)}")

    # Save to MongoDB
    note = {
        "subject":    subject,
        "type":       type,
        "sem":        sem,
        "file":       file.filename,
        "fileUrl":    file_url,
        "uploadedBy": uploadedBy,
        "date":       datetime.utcnow().isoformat(),
        "size":       f"{len(file_bytes) / 1024:.1f} KB",
    }
    result = await notes_col.insert_one(note)
    note["id"] = str(result.inserted_id)
    del note["_id"]

    return note


# ── GET NOTES BY SEM ──────────────────────────────────────────
@router.get("/{sem}")
async def get_notes_by_sem(sem: str):
    notes = []
    async for n in notes_col.find({"sem": sem}).sort("date", -1):
        n["id"] = str(n["_id"])
        del n["_id"]
        notes.append(n)
    return notes


# ── GET ALL NOTES ─────────────────────────────────────────────
@router.get("/")
async def get_all_notes():
    notes = []
    async for n in notes_col.find().sort("date", -1):
        n["id"] = str(n["_id"])
        del n["_id"]
        notes.append(n)
    return notes


# ── DELETE NOTE ───────────────────────────────────────────────
@router.delete("/{note_id}")
async def delete_note(note_id: str):
    result = await notes_col.delete_one({"_id": ObjectId(note_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Note not found.")
    return {"message": "Note deleted successfully."}
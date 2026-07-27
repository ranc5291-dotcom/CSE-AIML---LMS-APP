from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from datetime import datetime
from bson import ObjectId
import cloudinary
import cloudinary.uploader
import os

from database import assignments_col

router = APIRouter(prefix="/assignments", tags=["Assignments"])


@router.post("/upload", status_code=201)
async def upload_assignment(
    title:       str = Form(...),
    subject:     str = Form(...),
    due:         str = Form(...),
    sem:         str = Form(...),
    uploadedBy:  str = Form(...),
    file: UploadFile = File(None),   # file is optional
):
    file_url  = None
    file_name = None

    if file:
        file_bytes = await file.read()
        try:
            result = cloudinary.uploader.upload(
                file_bytes,
                folder        = f"cseaiml_lms/assignments/{sem}",
                resource_type = "auto",
            )
            file_url  = result["secure_url"]
            file_name = file.filename
        except Exception as e:
            raise HTTPException(500, f"File upload failed: {str(e)}")

    assignment = {
        "title":      title,
        "subject":    subject,
        "due":        due,
        "sem":        sem,
        "fileUrl":    file_url,
        "file":       file_name,
        "uploadedBy": uploadedBy,
        "date":       datetime.utcnow().isoformat(),
    }
    result = await assignments_col.insert_one(assignment)
    assignment["id"] = str(result.inserted_id)
    del assignment["_id"]
    return assignment


@router.get("/{sem}")
async def get_assignments_by_sem(sem: str):
    items = []
    async for a in assignments_col.find({"sem": sem}).sort("due", 1):
        a["id"] = str(a["_id"])
        del a["_id"]
        items.append(a)
    return items


@router.delete("/{assignment_id}")
async def delete_assignment(assignment_id: str):
    result = await assignments_col.delete_one({"_id": ObjectId(assignment_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Assignment not found.")
    return {"message": "Deleted successfully."}
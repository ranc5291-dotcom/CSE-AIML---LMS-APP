from fastapi import APIRouter, HTTPException
from datetime import datetime
from bson import ObjectId

from database import complaints_col, announcements_col, events_col, companies_col
from models import (
    ComplaintCreate, ComplaintStatusUpdate,
    AnnouncementCreate,
    EventCreate,
    CompanyCreate,
)

# ── COMPLAINTS ────────────────────────────────────────────────
complaints_router = APIRouter(prefix="/complaints", tags=["Complaints"])

@complaints_router.post("/", status_code=201)
async def add_complaint(data: ComplaintCreate, by: str):
    doc = {**data.dict(), "by": by, "status": "Pending",
           "date": datetime.utcnow().isoformat()}
    result = await complaints_col.insert_one(doc)
    doc["id"] = str(result.inserted_id); del doc["_id"]
    return doc

@complaints_router.get("/")
async def get_complaints():
    items = []
    async for c in complaints_col.find().sort("date", -1):
        c["id"] = str(c["_id"]); del c["_id"]; items.append(c)
    return items

@complaints_router.patch("/{complaint_id}/status")
async def update_complaint_status(complaint_id: str, data: ComplaintStatusUpdate):
    await complaints_col.update_one(
        {"_id": ObjectId(complaint_id)}, {"$set": {"status": data.status}})
    return {"message": "Status updated."}

@complaints_router.delete("/{complaint_id}")
async def delete_complaint(complaint_id: str):
    await complaints_col.delete_one({"_id": ObjectId(complaint_id)})
    return {"message": "Deleted."}


# ── ANNOUNCEMENTS ─────────────────────────────────────────────
announcements_router = APIRouter(prefix="/announcements", tags=["Announcements"])

@announcements_router.post("/", status_code=201)
async def add_announcement(data: AnnouncementCreate, postedBy: str):
    doc = {**data.dict(), "postedBy": postedBy,
           "time": datetime.utcnow().isoformat()}
    result = await announcements_col.insert_one(doc)
    doc["id"] = str(result.inserted_id); del doc["_id"]
    return doc

@announcements_router.get("/")
async def get_announcements():
    items = []
    async for a in announcements_col.find().sort("time", -1):
        a["id"] = str(a["_id"]); del a["_id"]; items.append(a)
    return items

@announcements_router.delete("/{ann_id}")
async def delete_announcement(ann_id: str):
    await announcements_col.delete_one({"_id": ObjectId(ann_id)})
    return {"message": "Deleted."}


# ── EVENTS ────────────────────────────────────────────────────
events_router = APIRouter(prefix="/events", tags=["Events"])

@events_router.post("/", status_code=201)
async def add_event(data: EventCreate, organizer: str):
    doc = {**data.dict(), "organizer": organizer, "joined": []}
    result = await events_col.insert_one(doc)
    doc["id"] = str(result.inserted_id); del doc["_id"]
    return doc

@events_router.get("/")
async def get_events():
    items = []
    async for e in events_col.find().sort("date", 1):
        e["id"] = str(e["_id"]); del e["_id"]; items.append(e)
    return items

@events_router.post("/{event_id}/join")
async def join_event(event_id: str, userId: str):
    event = await events_col.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(404, "Event not found.")
    joined = event.get("joined", [])
    if userId in joined:
        joined.remove(userId)
        msg = "Left event."
    else:
        joined.append(userId)
        msg = "Joined event."
    await events_col.update_one(
        {"_id": ObjectId(event_id)}, {"$set": {"joined": joined}})
    return {"message": msg, "joined": joined}

@events_router.delete("/{event_id}")
async def delete_event(event_id: str):
    await events_col.delete_one({"_id": ObjectId(event_id)})
    return {"message": "Deleted."}


# ── COMPANIES ─────────────────────────────────────────────────
companies_router = APIRouter(prefix="/companies", tags=["Companies"])

@companies_router.post("/", status_code=201)
async def add_company(data: CompanyCreate):
    doc = {**data.dict(), "createdAt": datetime.utcnow().isoformat()}
    result = await companies_col.insert_one(doc)
    doc["id"] = str(result.inserted_id); del doc["_id"]
    return doc

@companies_router.get("/")
async def get_companies():
    items = []
    async for c in companies_col.find().sort("createdAt", -1):
        c["id"] = str(c["_id"]); del c["_id"]; items.append(c)
    return items

@companies_router.delete("/{company_id}")
async def delete_company(company_id: str):
    await companies_col.delete_one({"_id": ObjectId(company_id)})
    return {"message": "Deleted."}
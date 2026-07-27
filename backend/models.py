from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# ── AUTH ──────────────────────────────────────────────────────
class RegisterStudent(BaseModel):
    name: str
    usn: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    branch: str = "CSEAIML"
    year: str
    sem: str
    startYear: str

class RegisterStaff(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: str           # "faculty" | "placement" | "admin"
    subject: Optional[str] = None
    dept: Optional[str] = "CSEAIML"

class LoginRequest(BaseModel):
    email: str
    password: str
    role: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# ── NOTES ─────────────────────────────────────────────────────
class NoteCreate(BaseModel):
    subject: str
    type: str           # "Notes" | "PYQ" | "Assignment" | "Reference"
    sem: str
    uploadedBy: str

class NoteResponse(BaseModel):
    id: str
    subject: str
    type: str
    sem: str
    file: str
    fileUrl: str
    uploadedBy: str
    date: str


# ── ASSIGNMENTS ───────────────────────────────────────────────
class AssignmentCreate(BaseModel):
    title: str
    subject: str
    due: str
    sem: str

class AssignmentResponse(BaseModel):
    id: str
    title: str
    subject: str
    due: str
    sem: str
    fileUrl: Optional[str] = None
    uploadedBy: str
    date: str


# ── ATTENDANCE ────────────────────────────────────────────────
class AttendanceUpdate(BaseModel):
    studentId: str
    studentName: str
    subject: str
    sem: str
    value: float

class AttendanceResponse(BaseModel):
    studentId: str
    subject: str
    sem: str
    value: float


# ── MARKS ─────────────────────────────────────────────────────
class MarksUpdate(BaseModel):
    studentId: str
    studentName: str
    subject: str
    sem: str
    value: float

class MarksResponse(BaseModel):
    studentId: str
    subject: str
    sem: str
    value: float


# ── COMPLAINTS ────────────────────────────────────────────────
class ComplaintCreate(BaseModel):
    title: str
    desc: str
    category: str

class ComplaintStatusUpdate(BaseModel):
    status: str         # "Pending" | "In Progress" | "Resolved"

class ComplaintResponse(BaseModel):
    id: str
    title: str
    desc: str
    category: str
    status: str
    by: str
    date: str


# ── ANNOUNCEMENTS ─────────────────────────────────────────────
class AnnouncementCreate(BaseModel):
    title: str
    tag: str            # "Exam" | "Event" | "Notice" etc.

class AnnouncementResponse(BaseModel):
    id: str
    title: str
    tag: str
    postedBy: str
    time: str


# ── EVENTS ────────────────────────────────────────────────────
class EventCreate(BaseModel):
    title: str
    desc: str
    date: str
    time: str
    venue: str
    tag: str
    googleFormUrl: Optional[str] = ""

class EventResponse(BaseModel):
    id: str
    title: str
    desc: str
    date: str
    time: str
    venue: str
    tag: str
    organizer: str
    joined: List[str] = []
    googleFormUrl: str


# ── COMPANIES ─────────────────────────────────────────────────
class CompanyCreate(BaseModel):
    name: str
    role: str
    package: str
    deadline: Optional[str] = ""
    status: str = "Open"
    eligibility: Optional[str] = ""
    description: Optional[str] = ""
    googleFormUrl: Optional[str] = ""

class CompanyResponse(BaseModel):
    id: str
    name: str
    role: str
    package: str
    deadline: str
    status: str
    eligibility: str
    description: str
    googleFormUrl: str
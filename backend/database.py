from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME   = os.getenv("DB_NAME", "cseaiml_lms")

client = AsyncIOMotorClient(MONGO_URL)
db     = client[DB_NAME]

# Collections
users_col         = db["users"]
notes_col         = db["notes"]
assignments_col   = db["assignments"]
attendance_col    = db["attendance"]
marks_col         = db["marks"]
complaints_col    = db["complaints"]
announcements_col = db["announcements"]
events_col        = db["events"]
companies_col     = db["companies"]
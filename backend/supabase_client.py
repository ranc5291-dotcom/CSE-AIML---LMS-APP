"""
supabase_client.py

Backend-side Supabase client using the SERVICE ROLE key (not the anon
key your frontend uses in src/utils/supabase.js). This lets the FastAPI
backend read/write tables like ai_support_usage without RLS getting in
the way, since your users aren't Supabase Auth users.

NEVER expose SUPABASE_SERVICE_ROLE_KEY to the frontend — it bypasses all
row-level security. It only belongs in the backend's .env / Render env vars.
"""

import os
from supabase import create_client, Client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
import firebase_admin
from firebase_admin import credentials
import os

# Path to the service account JSON you downloaded from Firebase Console.
# NEVER commit this file — add it to .gitignore and set the path via env var.
SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "firebase-service-account.json")

_firebase_app = None

def get_firebase_app():
    global _firebase_app
    if _firebase_app is None:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        _firebase_app = firebase_admin.initialize_app(cred)
    return _firebase_app
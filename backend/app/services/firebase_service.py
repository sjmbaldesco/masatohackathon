import firebase_admin
from firebase_admin import credentials, firestore, auth as fb_auth

from app.config import settings

# Initialize once
if not firebase_admin._apps:
    cred = credentials.Certificate(settings.firebase_service_account_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()


# --- Auth helpers ---

def verify_id_token(token: str) -> dict:
    """Verify Firebase ID token and return decoded claims."""
    return fb_auth.verify_id_token(token)


# --- Firestore helpers ---

def get_doc(collection: str, doc_id: str) -> dict | None:
    doc = db.collection(collection).document(doc_id).get()
    return doc.to_dict() if doc.exists else None


def set_doc(collection: str, doc_id: str, data: dict, merge: bool = True):
    db.collection(collection).document(doc_id).set(data, merge=merge)


def delete_doc(collection: str, doc_id: str):
    db.collection(collection).document(doc_id).delete()


def query_collection(collection: str, filters: list[tuple]) -> list[dict]:
    """
    filters: [("field", "op", value), ...]
    ops: "==", "<", ">", "<=", ">="
    """
    ref = db.collection(collection)
    for field, op, value in filters:
        ref = ref.where(field, op, value)
    return [{"id": d.id, **d.to_dict()} for d in ref.stream()]

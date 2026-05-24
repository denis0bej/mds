import hashlib
import os
import secrets
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def init_db() -> None:
    try:
        get_client()
        print("[INFO] Supabase connected successfully.")
    except RuntimeError as e:
        print(f"[WARNING] Supabase not configured: {e}")


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), 100_000
    )
    return f"{salt}${pwd_hash.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt, pwd_hash = stored.split("$", 1)
    new_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), 100_000
    )
    return secrets.compare_digest(new_hash.hex(), pwd_hash)


def create_user(username: str, email: str, password: str) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    password_hash = hash_password(password)
    db = get_client()
    res = db.table("users").insert({
        "username": username,
        "email": email.lower(),
        "password_hash": password_hash,
        "created_at": now,
    }).execute()
    if res.data:
        print(f"[Supabase] OK User created: {res.data[0]['username']} (id={res.data[0]['id']})")
        return res.data[0]
    else:
        print(f"[Supabase] FAIL - no data returned for user: {username}")
        raise Exception("User creation failed - no data returned from Supabase.")


def get_user_by_id(user_id: int) -> Optional[dict]:
    db = get_client()
    res = db.table("users").select("id, username, email, created_at").eq("id", user_id).single().execute()
    return res.data if res.data else None


def get_user_by_email(email: str) -> Optional[dict]:
    db = get_client()
    res = db.table("users").select("id, username, email, password_hash, created_at").eq("email", email.lower()).execute()
    return res.data[0] if res.data else None


def get_user_by_username(username: str) -> Optional[dict]:
    db = get_client()
    res = db.table("users").select("id, username, email, password_hash, created_at").eq("username", username).execute()
    return res.data[0] if res.data else None


def create_auth_token(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc).isoformat()
    db = get_client()
    db.table("auth_tokens").insert({
        "token": token,
        "user_id": user_id,
        "created_at": now,
    }).execute()
    return token


def delete_auth_token(token: str) -> None:
    db = get_client()
    db.table("auth_tokens").delete().eq("token", token).execute()


def get_user_by_token(token: str) -> Optional[dict]:
    db = get_client()
    res = db.table("auth_tokens").select("user_id").eq("token", token).execute()
    if not res.data:
        return None
    user_id = res.data[0]["user_id"]
    return get_user_by_id(user_id)

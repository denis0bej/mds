import re
import sqlite3

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, field_validator

from database import (
    create_auth_token,
    create_user,
    delete_auth_token,
    get_user_by_email,
    get_user_by_token,
    get_user_by_username,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        username = value.strip()
        if len(username) < 3:
            raise ValueError("Username must be at least 3 characters.")
        if len(username) > 32:
            raise ValueError("Username must be at most 32 characters.")
        if not re.match(r"^[a-zA-Z0-9_]+$", username):
            raise ValueError("Username may only contain letters, numbers, and underscores.")
        return username

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        email = value.strip().lower()
        if not EMAIL_REGEX.match(email):
            raise ValueError("Invalid email address.")
        return email

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return value


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        email = value.strip().lower()
        if not EMAIL_REGEX.match(email):
            raise ValueError("Invalid email address.")
        return email


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        from database import get_client
        res = get_client().auth.get_user(token)
        supabase_user = res.user
        if not supabase_user:
            raise HTTPException(status_code=401, detail="Invalid or expired session.")
        return {
            "id": supabase_user.id,
            "email": supabase_user.email,
            "username": (supabase_user.user_metadata or {}).get("username", supabase_user.email),
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "created_at": user["created_at"],
    }


@router.post("/register")
async def register(req: RegisterRequest):
    if get_user_by_email(req.email):
        raise HTTPException(status_code=409, detail="Email is already registered.")
    if get_user_by_username(req.username):
        raise HTTPException(status_code=409, detail="Username is already taken.")

    try:
        user = create_user(req.username, req.email, req.password)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Account could not be created.")

    token = create_auth_token(user["id"])
    return {"token": token, "user": _public_user(user)}


@router.post("/login")
async def login(req: LoginRequest):
    user = get_user_by_email(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_auth_token(user["id"])
    return {"token": token, "user": _public_user(user)}


@router.post("/logout")
async def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        delete_auth_token(token)
    return {"message": "Logged out."}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": _public_user(user)}

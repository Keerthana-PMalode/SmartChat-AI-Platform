from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.auth import verify_token
from app.models.user import User


# -----------------------------
# Database Dependency
# -----------------------------

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# -----------------------------
# JWT Authentication
# -----------------------------

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):

    token = credentials.credentials

    payload = verify_token(token)

    print("JWT PAYLOAD:", payload)

    if payload is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    return payload

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):

    token = credentials.credentials

    payload = verify_token(token)

    if payload is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )


    user_id = payload.get("user_id")
    print("User_ID:", user_id)

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="User ID missing from token"
        )


    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )


    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )


    return user


# -----------------------------
# Admin Authorization
# -----------------------------

def require_admin(
    current_user=Depends(get_current_user),
):

    if current_user.role != "admin":

        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )


    return current_user
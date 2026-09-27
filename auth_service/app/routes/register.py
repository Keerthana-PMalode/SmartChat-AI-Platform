from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.models.system import SystemSetting
from app.models.user import User
from app.schemas.admin import RegisterRequest
from app.core.auth import hash_password

router = APIRouter()


@router.post("/register")
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # Check whether registration is enabled
    # --------------------------------------------------------

    setting = (
        db.query(SystemSetting)
        .filter(
            SystemSetting.key == "allow_user_registration"
        )
        .first()
    )

    allow_registration = True

    if setting:
        allow_registration = (
            setting.value.lower() == "true"
        )

    if not allow_registration:
        raise HTTPException(
            status_code=403,
            detail="User registration is currently disabled.",
        )

    # --------------------------------------------------------
    # Check existing username
    # --------------------------------------------------------

    existing_user = (
        db.query(User)
        .filter(User.username == payload.username)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Username already exists.",
        )

    # --------------------------------------------------------
    # Create user
    # --------------------------------------------------------

    user = User(
        username=payload.username,
        hashed_password=hash_password(payload.password),
        role="user",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "message": "Registration successful.",
    }

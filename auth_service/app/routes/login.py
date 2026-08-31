from app.core.auth import create_access_token, verify_password
from app.core.dependencies import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter()


@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):

    user = db.query(User).filter(User.username == request.username).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        {"user_id": user.id, "sub": user.username, "role": user.role}
    )

    return {"access_token": token}

from app.core.auth import verify_token
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class TokenRequest(BaseModel):
    token: str


@router.post("/validate-token")
def validate_token(request: TokenRequest):

    payload = verify_token(request.token)

    if not payload:
        return {"valid": False}

    return {
        "valid": True,
        "user_id": payload.get("user_id"),
        "username": payload.get("sub"),
        "role": payload.get("role"),
    }

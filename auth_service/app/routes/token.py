from fastapi import APIRouter
from pydantic import BaseModel
from app.core.auth import verify_token

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
        "user_id": payload.get("sub")
    }
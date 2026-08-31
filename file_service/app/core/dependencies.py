import os

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

security = HTTPBearer()

SECRET_KEY = os.getenv("SECRET_KEY", "secret")

ALGORITHM = "HS256"


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):

    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        user_id = payload.get("user_id")

        if user_id is None:
            raise HTTPException(status_code=401, detail="User ID missing in token")

        return int(user_id)

    except JWTError as e:
        print("JWT ERROR:", str(e))

        raise HTTPException(status_code=401, detail="Invalid or expired token")

import os

from jose import JWTError, jwt

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is not set.")

ALGORITHM = "HS256"


def get_user_from_token(headers):
    auth = headers.get("Authorization")

    if not auth:
        return "guest"

    token = auth.replace("Bearer ", "")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        return payload.get("user_id", "guest")

    except JWTError:
        return "guest"

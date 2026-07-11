import requests
from requests.exceptions import (
    ConnectionError,
    HTTPError,
    Timeout,
    RequestException,
)

FASTAPI_URL = "http://auth_service:8000/chat/history"


def save_chat(
    session_id: str,
    sender: str,
    message: str,
    response: str = None,
    token: str = None,
) -> bool:
    """
    Save chat history through the FastAPI service.

    Args:
        session_id: Unique session identifier.
        sender: "user" or "bot".
        message: User or bot message.
        response: Optional bot response.
        token: JWT access token.

    Returns:
        True if chat was saved successfully, otherwise False.
    """

    if not message:
        print("Chat history not saved: message is empty.")
        return False

    payload = {
        "session_id": session_id,
        "sender": sender,
        "message": message,
        "response": response,
    }

    headers = {
        "Content-Type": "application/json"
    }

    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        result = requests.post(
            FASTAPI_URL,
            json=payload,
            headers=headers,
            timeout=5,
        )

        result.raise_for_status()

        print(f"Chat history saved successfully. Session: {session_id}")

        return True

    except Timeout:
        print("Unable to save chat history: Request timed out.")

    except ConnectionError:
        print("Unable to save chat history: Could not connect to auth_service.")

    except HTTPError:
        print(
            f"Unable to save chat history: HTTP {result.status_code} - "
            f"{result.text}"
        )

    except RequestException as e:
        print(f"Unable to save chat history: {e}")

    except Exception as e:
        print(f"Unexpected error while saving chat history: {e}")

    return False
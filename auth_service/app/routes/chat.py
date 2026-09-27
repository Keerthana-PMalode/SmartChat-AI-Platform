from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, get_current_session
from app.models.chat import ChatHistory, ChatMessage
from app.models.system import SystemSetting
from app.schemas.chat import ChatCreate, ChatResponse


router = APIRouter()


@router.post("/chat/history", response_model=ChatResponse)
def save_chat(
    chat: ChatCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    session_id=Depends(get_current_session),
):
    maintenance_setting = (
        db.query(SystemSetting)
        .filter(SystemSetting.key == "maintenance_mode")
        .first()
    )

    maintenance_mode = (
        maintenance_setting is not None
        and maintenance_setting.value.lower() == "true"
    )

    if maintenance_mode and current_user.role != "admin":
        raise HTTPException(
            status_code=503,
            detail=(
                "The chatbot is currently under maintenance. "
                "Please try again later."
            ),
        )

    setting = (
        db.query(SystemSetting)
        .filter(SystemSetting.key == "max_message_length")
        .first()
    )

    max_message_length = 5000

    if setting:
        try:
            max_message_length = int(setting.value)
        except (TypeError, ValueError):
            max_message_length = 5000

    if len(chat.message) > max_message_length:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Message exceeds the maximum "
                f"length of {max_message_length} characters."
            ),
        )

    # Find the existing conversation for this user/session.
    chat_entry = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.session_id == session_id,
            ChatHistory.user_id == current_user.id,
        )
        .first()
    )

    # Create the conversation only for the first message.
    if not chat_entry:
        chat_entry = ChatHistory(
            session_id=session_id,
            user_id=current_user.id,
        )

        db.add(chat_entry)
        db.flush()

    # Store user message.
    user_message = ChatMessage(
        chat_id=chat_entry.id,
        role="user",
        content=chat.message,
    )

    db.add(user_message)

    # Store chatbot response.
    if chat.response:
        chatbot_message = ChatMessage(
            chat_id=chat_entry.id,
            role="chatbot",
            content=chat.response,
        )

        db.add(chatbot_message)

    db.commit()
    db.refresh(chat_entry)

    return chat_entry


@router.get(
    "/chat/history",
    response_model=list[ChatResponse],
)
def get_chat_history(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    session_id=Depends(get_current_session),
):
    chats = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.session_id == session_id,
            ChatHistory.user_id == current_user.id,
        )
        .order_by(ChatHistory.timestamp.asc())
        .all()
    )

    if not chats:
        raise HTTPException(
            status_code=404,
            detail="No chat history found for this session",
        )

    return chats

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.chat import ChatHistory, ChatMessage
from app.schemas.chat import ChatCreate, ChatResponse

router = APIRouter()


@router.post("/chat/history", response_model=ChatResponse)
def save_chat(
    chat: ChatCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    chat_entry = ChatHistory(
        session_id=chat.session_id,
        user_id=current_user.id,
    )

    db.add(chat_entry)

    # Get chat_history.id before creating chat_messages
    db.flush()

    # Store user message
    user_message = ChatMessage(
        chat_id=chat_entry.id,
        role="user",
        content=chat.message,
    )

    db.add(user_message)

    # Store chatbot response
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


@router.get("/chat/history/{session_id}", response_model=list[ChatResponse])
def get_chat_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
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

    for chat in chats:
        print("CHAT OBJECT:")
        print(chat.__dict__)

    if not chats:
        raise HTTPException(
            status_code=404,
            detail="No chat history found for this session",
        )

    return chats
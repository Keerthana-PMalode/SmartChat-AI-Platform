from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models.chat import ChatHistory
from app.schemas.chat import ChatCreate, ChatResponse


router = APIRouter()


@router.post(
    "/chat/history",
    response_model=ChatResponse
)
def save_chat(
    chat: ChatCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    chat_entry = ChatHistory(

        session_id=chat.session_id,

        sender=chat.sender,

        message=chat.message,

        response=chat.response,

        user_id=current_user.id

    )
    print("CURRENT USER FROM JWT:")
    print(current_user.id)


    db.add(chat_entry)

    db.commit()

    db.refresh(chat_entry)


    return chat_entry


@router.get(
    "/chat/history/{session_id}",
    response_model=list[ChatResponse]
)
def get_chat_history(
    session_id: str,
    db: Session = Depends(get_db)
):

    chats = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.session_id == session_id
        )
        .order_by(
            ChatHistory.timestamp.asc()
        )
        .all()
    )

    for chat in chats:
        print("CHAT OBJECT:")
        print(chat.__dict__)


    if not chats:

        raise HTTPException(
            status_code=404,
            detail="No chat history found for this session"
        )

    return chats


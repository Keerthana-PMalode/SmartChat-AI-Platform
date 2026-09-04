from app.core.auth import hash_password
from app.core.dependencies import get_db, require_admin
from app.models.chat import ChatHistory, ChatMessage
from app.models.user import User
from app.schemas.admin import CreateUserRequest, UpdateRoleRequest
from app.schemas.chat import ChatCreate, ChatResponse
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException


router = APIRouter()


@router.get("/dashboard")
def admin_dashboard(admin=Depends(require_admin), db: Session = Depends(get_db)):

    total_users = db.query(User).count()

    total_chats = db.query(ChatHistory).count()

    active_sessions = db.query(ChatHistory.session_id).distinct().count()

    today_chats = (
        db.query(ChatHistory)
        .filter(func.date(ChatHistory.timestamp) == date.today())
        .count()
    )

    return {
        "status": "success",
        "admin": admin.username,
        "role": admin.role,
        "stats": {
            "users": total_users,
            "chats": total_chats,
            "active_sessions": active_sessions,
            "today_chats": today_chats,
        },
    }


@router.get("/users")
def list_users(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).all()


@router.post("/users")
def create_user(
    request: CreateUserRequest,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.username == request.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(
        username=request.username,
        hashed_password=hash_password(request.password),
        role=request.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/role")
def update_role(
    user_id: int,
    request: UpdateRoleRequest,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = request.role
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # Prevent deleting your own account
    if user.username == admin.username:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete your own account",
        )

    # Prevent removing the last admin
    admin_count = db.query(User).filter(User.role == "admin").count()

    if user.role == "admin" and admin_count == 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot remove the last administrator",
        )

    # Save values before deleting the SQLAlchemy object
    deleted_username = user.username

    try:
        db.delete(user)
        db.commit()

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this user because they are referenced by other records.",
        )

    return {
        "status": "deleted",
        "user_id": user_id,
        "username": deleted_username,
    }


@router.get("/users/search")
def search_users(q: str, admin=Depends(require_admin), db: Session = Depends(get_db)):
    results = db.query(User).filter(User.username.ilike(f"%{q}%")).all()
    return results


@router.post("/users/{user_id}/chats", response_model=ChatResponse)
def store_chat(
    user_id: int,
    chat: ChatCreate,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # Create chat history/session record
    new_chat = ChatHistory(
        user_id=user.id,
        session_id=chat.session_id,
    )

    db.add(new_chat)

    # Get generated chat_history.id
    db.flush()

    # Store user message
    user_message = ChatMessage(
        chat_id=new_chat.id,
        role="user",
        content=chat.message,
    )

    db.add(user_message)

    # Store chatbot response
    if chat.response:
        chatbot_message = ChatMessage(
            chat_id=new_chat.id,
            role="chatbot",
            content=chat.response,
        )

        db.add(chatbot_message)

    try:
        db.commit()
        db.refresh(new_chat)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Database error",
        )

    return new_chat


@router.get("/users/{user_id}/chats", response_model=list[ChatResponse])
def get_chat_history(
    user_id: int, admin=Depends(require_admin), db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user_id)
        .order_by(ChatHistory.timestamp.desc())
        .all()
    )


@router.delete("/chat/history/{session_id}")
def delete_chat_history(
    session_id: str, admin=Depends(require_admin), db: Session = Depends(get_db)
):
    # Find chats for the given session
    chats = db.query(ChatHistory).filter(ChatHistory.session_id == session_id).all()
    if not chats:
        raise HTTPException(
            status_code=404, detail="No chat history found for this session"
        )

    # Delete all chats for that session
    db.query(ChatHistory).filter(ChatHistory.session_id == session_id).delete()
    db.commit()

    return {"detail": f"Chat history for session '{session_id}' has been deleted"}

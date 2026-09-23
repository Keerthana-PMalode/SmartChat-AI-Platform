from app.core.auth import hash_password
from app.core.dependencies import get_db, require_admin
from app.models.chat import ChatHistory, ChatMessage
from app.models.user import User
from app.schemas.admin import CreateUserRequest, UpdateRoleRequest
from app.schemas.chat import ChatCreate, ChatResponse
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, String
from datetime import date, datetime, timedelta, time
from sqlalchemy.exc import IntegrityError

from app.routes.admin_analytics import ANALYTICS_TIMEZONE

router = APIRouter()


@router.get("/dashboard")
def admin_dashboard(
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    # -------------------------------------------------------
    # TOTAL COUNTS
    # -------------------------------------------------------

    total_users = db.query(User).count()

    total_conversations = db.query(ChatHistory).count()

    total_messages = db.query(ChatMessage).count()

    # -------------------------------------------------------
    # ACTIVE USERS
    # -------------------------------------------------------
    #
    # Here "active users" means users who have at least
    # one conversation.
    #
    # If you later want "active in the last 24 hours",
    # this calculation can be changed.
    # -------------------------------------------------------

    active_users = (
        db.query(ChatHistory.user_id)
        .distinct()
        .count()
    )

    # -------------------------------------------------------
    # RECENT USERS
    # -------------------------------------------------------

    recent_users = (
        db.query(User)
        .order_by(User.id.desc())
        .limit(5)
        .all()
    )

    # -------------------------------------------------------
    # RECENT CONVERSATIONS
    # -------------------------------------------------------

    recent_chats = (
        db.query(ChatHistory)
        .join(
            User,
            ChatHistory.user_id == User.id,
        )
        .order_by(ChatHistory.timestamp.desc())
        .limit(5)
        .all()
    )

    # -------------------------------------------------------
    # ACTIVITY - LAST 7 DAYS
    # -------------------------------------------------------

    today = datetime.now(
        ANALYTICS_TIMEZONE
    ).date()

    activity_labels = []
    activity_conversations = []
    activity_messages = []

    for days_ago in range(6, -1, -1):
        activity_date = today - timedelta(days=days_ago)
        next_date = activity_date + timedelta(days=1)

        start_datetime = datetime.combine(
            activity_date,
            time.min,
            tzinfo=ANALYTICS_TIMEZONE,
        )

        end_datetime = datetime.combine(
            next_date,
            time.min,
            tzinfo=ANALYTICS_TIMEZONE,
        )

        conversation_count = (
            db.query(ChatHistory)
            .filter(
                ChatHistory.timestamp >= start_datetime,
                ChatHistory.timestamp < end_datetime,
            )
            .count()
        )

        message_count = (
            db.query(ChatMessage)
            .join(
                ChatHistory,
                ChatMessage.chat_id == ChatHistory.id,
            )
            .filter(
                ChatHistory.timestamp >= start_datetime,
                ChatHistory.timestamp < end_datetime,
            )
            .count()
        )

        activity_labels.append(
            activity_date.strftime("%b %d")
        )

        activity_conversations.append(
            conversation_count
        )

        activity_messages.append(
            message_count
        )

    # -------------------------------------------------------
    # RESPONSE
    # -------------------------------------------------------

    return {
        "status": "success",

        "admin": admin.username,

        "role": admin.role,

        "stats": {
            "users": total_users,
            "conversations": total_conversations,
            "messages": total_messages,
            "active_users": active_users,
        },

        "recent_users": [
            {
                "id": user.id,
                "username": user.username,
                "role": user.role,
            }
            for user in recent_users
        ],

        "recent_conversations": [
            {
                "id": chat.id,
                "user_id": chat.user_id,
                "user": chat.user.username,
                "date": chat.timestamp,
                "session_id": chat.session_id,
            }
            for chat in recent_chats
        ],

        "activity": {
            "labels": activity_labels,
            "conversations": activity_conversations,
            "messages": activity_messages,
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


@router.get("/users/{user_id}/chats", response_model=list[ChatResponse])
def get_user_chats(
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

    chats = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user.id)
        .order_by(ChatHistory.timestamp.desc())
        .all()
    )

    return chats


@router.get("/chats")
def get_all_chat_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    # ---------------------------------------
    # Base query
    # ---------------------------------------

    base_query = db.query(ChatHistory).join(
        User,
        ChatHistory.user_id == User.id,
    )

    # ---------------------------------------
    # Search
    # ---------------------------------------

    if search and search.strip():
        search_term = f"%{search.strip()}%"

        base_query = base_query.filter(
            or_(
                ChatHistory.id.cast(String).ilike(search_term),
                ChatHistory.user_id.cast(String).ilike(search_term),
                User.username.ilike(search_term),
                ChatHistory.session_id.ilike(search_term),
            )
        )

    # ---------------------------------------
    # Total matching conversations
    # ---------------------------------------

    total = base_query.count()

    # ---------------------------------------
    # Pagination
    # ---------------------------------------

    offset = (page - 1) * page_size

    chats = (
        base_query.order_by(ChatHistory.timestamp.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    # ---------------------------------------
    # Message counts for current page only
    # ---------------------------------------

    chat_ids = [chat.id for chat in chats]

    message_counts = {}

    if chat_ids:
        counts = (
            db.query(
                ChatMessage.chat_id,
                func.count(ChatMessage.id).label("message_count"),
            )
            .filter(ChatMessage.chat_id.in_(chat_ids))
            .group_by(ChatMessage.chat_id)
            .all()
        )

        message_counts = {chat_id: count for chat_id, count in counts}

    # ---------------------------------------
    # Response
    # ---------------------------------------

    items = [
        {
            "id": chat.id,
            "user_id": chat.user_id,
            "user": chat.user.username,
            "date": chat.timestamp,
            "session_id": chat.session_id,
            "messages": message_counts.get(
                chat.id,
                0,
            ),
            "status": "Completed",
        }
        for chat in chats
    ]

    total_pages = max(
        1,
        (total + page_size - 1) // page_size,
    )

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }


@router.get("/users/{user_id}/chats/{chat_id}/messages")
def get_chat_messages(
    user_id: int,
    chat_id: int,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    chat = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.id == chat_id,
            ChatHistory.user_id == user_id,
        )
        .first()
    )

    if not chat:
        raise HTTPException(
            status_code=404,
            detail="Chat not found",
        )

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.chat_id == chat.id)
        .order_by(ChatMessage.id.asc())
        .all()
    )

    return messages


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

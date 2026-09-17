from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_admin
from app.models.chat import ChatHistory, ChatMessage
from app.models.user import User


router = APIRouter()


# ============================================================
# HELPERS
# ============================================================

def _date_range(
    start_date: date | None,
    end_date: date | None,
):
    """
    Return inclusive datetime boundaries.

    If no dates are supplied, use the last 30 days including today.
    """
    today = date.today()

    if end_date is None:
        end_date = today

    if start_date is None:
        start_date = end_date - timedelta(days=29)

    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(
        end_date + timedelta(days=1),
        datetime.min.time(),
    )

    return start_date, end_date, start_datetime, end_datetime


# ============================================================
# OVERVIEW
# ============================================================

@router.get("/overview")
def analytics_overview(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    start_date, end_date, start_datetime, end_datetime = _date_range(
        start_date,
        end_date,
    )

    # --------------------------------------------------------
    # Total users
    # --------------------------------------------------------

    total_users = db.query(User).count()

    # --------------------------------------------------------
    # New users during selected period
    #
    # Your current User model may not have created_at.
    # Therefore this intentionally does not assume one exists.
    # --------------------------------------------------------

    total_chats = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.timestamp >= start_datetime,
            ChatHistory.timestamp < end_datetime,
        )
        .count()
    )

    # --------------------------------------------------------
    # Unique users who chatted
    # --------------------------------------------------------

    active_users = (
        db.query(func.count(distinct(ChatHistory.user_id)))
        .filter(
            ChatHistory.timestamp >= start_datetime,
            ChatHistory.timestamp < end_datetime,
            ChatHistory.user_id.isnot(None),
        )
        .scalar()
        or 0
    )

    # --------------------------------------------------------
    # Unique sessions
    # --------------------------------------------------------

    total_sessions = (
        db.query(func.count(distinct(ChatHistory.session_id)))
        .filter(
            ChatHistory.timestamp >= start_datetime,
            ChatHistory.timestamp < end_datetime,
            ChatHistory.session_id.isnot(None),
        )
        .scalar()
        or 0
    )

    # --------------------------------------------------------
    # Messages
    #
    # Count messages belonging to chats in selected period.
    # --------------------------------------------------------

    total_messages = (
        db.query(func.count(ChatMessage.id))
        .join(
            ChatHistory,
            ChatMessage.chat_id == ChatHistory.id,
        )
        .filter(
            ChatHistory.timestamp >= start_datetime,
            ChatHistory.timestamp < end_datetime,
        )
        .scalar()
        or 0
    )

    # --------------------------------------------------------
    # Average messages per conversation
    # --------------------------------------------------------

    average_messages_per_chat = (
        round(total_messages / total_chats, 2)
        if total_chats
        else 0
    )

    # --------------------------------------------------------
    # Chats today
    # --------------------------------------------------------

    today_start = datetime.combine(
        date.today(),
        datetime.min.time(),
    )

    tomorrow_start = today_start + timedelta(days=1)

    today_chats = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.timestamp >= today_start,
            ChatHistory.timestamp < tomorrow_start,
        )
        .count()
    )

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_users": total_users,
        "active_users": active_users,
        "total_chats": total_chats,
        "total_sessions": total_sessions,
        "total_messages": total_messages,
        "average_messages_per_chat": average_messages_per_chat,
        "today_chats": today_chats,
    }


# ============================================================
# DAILY CHAT ACTIVITY
# ============================================================

@router.get("/chat-activity")
def analytics_chat_activity(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    start_date, end_date, start_datetime, end_datetime = _date_range(
        start_date,
        end_date,
    )

    rows = (
        db.query(
            func.date(ChatHistory.timestamp).label("date"),
            func.count(ChatHistory.id).label("chats"),
            func.count(
                distinct(ChatHistory.user_id)
            ).label("users"),
            func.count(
                distinct(ChatHistory.session_id)
            ).label("sessions"),
        )
        .filter(
            ChatHistory.timestamp >= start_datetime,
            ChatHistory.timestamp < end_datetime,
        )
        .group_by(
            func.date(ChatHistory.timestamp)
        )
        .order_by(
            func.date(ChatHistory.timestamp)
        )
        .all()
    )

    activity_by_date = {
        row.date: {
            "chats": row.chats,
            "users": row.users,
            "sessions": row.sessions,
        }
        for row in rows
    }

    result = []

    current = start_date

    while current <= end_date:
        values = activity_by_date.get(
            current,
            {
                "chats": 0,
                "users": 0,
                "sessions": 0,
            },
        )

        result.append(
            {
                "date": current.isoformat(),
                "chats": values["chats"],
                "users": values["users"],
                "sessions": values["sessions"],
            }
        )

        current += timedelta(days=1)

    return result


# ============================================================
# MESSAGE ACTIVITY
# ============================================================

@router.get("/message-activity")
def analytics_message_activity(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    start_date, end_date, start_datetime, end_datetime = _date_range(
        start_date,
        end_date,
    )

    rows = (
        db.query(
            func.date(ChatHistory.timestamp).label("date"),
            func.count(ChatMessage.id).label("messages"),
        )
        .join(
            ChatHistory,
            ChatMessage.chat_id == ChatHistory.id,
        )
        .filter(
            ChatHistory.timestamp >= start_datetime,
            ChatHistory.timestamp < end_datetime,
        )
        .group_by(
            func.date(ChatHistory.timestamp)
        )
        .order_by(
            func.date(ChatHistory.timestamp)
        )
        .all()
    )

    message_by_date = {
        row.date: row.messages
        for row in rows
    }

    result = []

    current = start_date

    while current <= end_date:
        result.append(
            {
                "date": current.isoformat(),
                "messages": message_by_date.get(
                    current,
                    0,
                ),
            }
        )

        current += timedelta(days=1)

    return result


# ============================================================
# TOP USERS
# ============================================================

@router.get("/top-users")
def analytics_top_users(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    limit: int = Query(10, ge=1, le=100),
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    _, _, start_datetime, end_datetime = _date_range(
        start_date,
        end_date,
    )

    rows = (
        db.query(
            User.id.label("user_id"),
            User.username.label("username"),
            func.count(
                distinct(ChatHistory.id)
            ).label("chats"),
            func.count(
                ChatMessage.id
            ).label("messages"),
        )
        .join(
            ChatHistory,
            ChatHistory.user_id == User.id,
        )
        .outerjoin(
            ChatMessage,
            ChatMessage.chat_id == ChatHistory.id,
        )
        .filter(
            ChatHistory.timestamp >= start_datetime,
            ChatHistory.timestamp < end_datetime,
        )
        .group_by(
            User.id,
            User.username,
        )
        .order_by(
            func.count(
                distinct(ChatHistory.id)
            ).desc()
        )
        .limit(limit)
        .all()
    )

    return [
        {
            "user_id": row.user_id,
            "username": row.username,
            "chats": row.chats,
            "messages": row.messages,
        }
        for row in rows
    ]


# ============================================================
# CHAT STATISTICS
# ============================================================

@router.get("/chat-statistics")
def analytics_chat_statistics(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    _, _, start_datetime, end_datetime = _date_range(
        start_date,
        end_date,
    )

    total_chats = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.timestamp >= start_datetime,
            ChatHistory.timestamp < end_datetime,
        )
        .count()
    )

    total_messages = (
        db.query(func.count(ChatMessage.id))
        .join(
            ChatHistory,
            ChatMessage.chat_id == ChatHistory.id,
        )
        .filter(
            ChatHistory.timestamp >= start_datetime,
            ChatHistory.timestamp < end_datetime,
        )
        .scalar()
        or 0
    )

    sessions = (
        db.query(
            ChatHistory.session_id,
            func.count(ChatHistory.id).label("chat_count"),
        )
        .filter(
            ChatHistory.timestamp >= start_datetime,
            ChatHistory.timestamp < end_datetime,
            ChatHistory.session_id.isnot(None),
        )
        .group_by(
            ChatHistory.session_id
        )
        .all()
    )

    session_count = len(sessions)

    average_chats_per_session = (
        round(total_chats / session_count, 2)
        if session_count
        else 0
    )

    average_messages_per_chat = (
        round(total_messages / total_chats, 2)
        if total_chats
        else 0
    )

    return {
        "total_chats": total_chats,
        "total_messages": total_messages,
        "total_sessions": session_count,
        "average_chats_per_session": average_chats_per_session,
        "average_messages_per_chat": average_messages_per_chat,
    }


# ============================================================
# HOURLY ACTIVITY
# ============================================================

@router.get("/hourly-activity")
def analytics_hourly_activity(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    _, _, start_datetime, end_datetime = _date_range(
        start_date,
        end_date,
    )

    rows = (
        db.query(
            func.extract(
                "hour",
                ChatHistory.timestamp,
            ).label("hour"),
            func.count(ChatHistory.id).label("chats"),
        )
        .filter(
            ChatHistory.timestamp >= start_datetime,
            ChatHistory.timestamp < end_datetime,
        )
        .group_by(
            func.extract(
                "hour",
                ChatHistory.timestamp,
            )
        )
        .order_by(
            func.extract(
                "hour",
                ChatHistory.timestamp,
            )
        )
        .all()
    )

    activity = {
        int(row.hour): row.chats
        for row in rows
    }

    return [
        {
            "hour": hour,
            "chats": activity.get(hour, 0),
        }
        for hour in range(24)
    ]
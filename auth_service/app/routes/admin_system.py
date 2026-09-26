import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_admin
from app.models.system import SystemSetting, AuditLog
from app.schemas.admin import UpdateSettingsRequest


router = APIRouter()


# ============================================================
# HELPERS
# ============================================================

def create_audit_log(
    db: Session,
    admin,
    action: str,
    details: str | None = None,
    level: str = "info",
):
    log = AuditLog(
        user_id=admin.id if admin else None,
        username=admin.username if admin else None,
        level=level,
        action=action,
        details=details,
    )

    db.add(log)

    return log


def serialize_setting(key: str, value: str):
    if key in {"maintenance_mode", "allow_user_registration"}:
        return value.lower() == "true"

    if key == "max_message_length":
        return int(value)

    return value


# ============================================================
# SETTINGS
# ============================================================

DEFAULT_SETTINGS = {
    "application_name": "ChatBot",
    "max_message_length": "5000",
    "maintenance_mode": "false",
    "allow_user_registration": "true",
};    


@router.get("/settings")
def get_settings(
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    settings = {}

    rows = db.query(SystemSetting).all()

    for row in rows:
        settings[row.key] = serialize_setting(
            row.key,
            row.value,
        )

    for key, default_value in DEFAULT_SETTINGS.items():
        if key not in settings:
            settings[key] = serialize_setting(
                key,
                default_value,
            )

    return {
        "status": "success",
        "settings": settings,
    }


@router.put("/settings")
def update_settings(
    payload: UpdateSettingsRequest,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    updated = []

    settings = payload.model_dump(exclude_unset=True)

    for key, value in settings.items():
        if value is None:
            continue

        value = str(value)

        setting = (
            db.query(SystemSetting)
            .filter(SystemSetting.key == key)
            .first()
        )

        if setting:
            setting.value = value
        else:
            setting = SystemSetting(
                key=key,
                value=value,
            )
            db.add(setting)

        updated.append(key)

    create_audit_log(
        db=db,
        admin=admin,
        action="Updated system settings",
        details=", ".join(updated) if updated else "No settings changed",
    )

    db.commit()

    return {
        "status": "success",
        "updated": updated,
    }


# ============================================================
# LOGS
# ============================================================

@router.get("/logs")
def get_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    level: str = Query("all"),
    search: str | None = Query(None),
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)

    # --------------------------------------------------------
    # Level filter
    # --------------------------------------------------------

    if level and level.lower() != "all":
        query = query.filter(
            AuditLog.level == level.lower()
        )

    # --------------------------------------------------------
    # Search
    # --------------------------------------------------------

    if search and search.strip():
        search_term = f"%{search.strip()}%"

        query = query.filter(
            AuditLog.action.ilike(search_term)
            | AuditLog.details.ilike(search_term)
            | AuditLog.username.ilike(search_term)
        )

    # --------------------------------------------------------
    # Total
    # --------------------------------------------------------

    total = query.count()

    # --------------------------------------------------------
    # Pagination
    # --------------------------------------------------------

    offset = (page - 1) * page_size

    logs = (
        query
        .order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    total_pages = max(
        1,
        (total + page_size - 1) // page_size,
    )

    return {
        "items": [
            {
                "id": log.id,
                "timestamp": log.timestamp,
                "user_id": log.user_id,
                "user": log.username or "System",
                "level": log.level,
                "action": log.action,
                "details": log.details,
            }
            for log in logs
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }


# ============================================================
# EXPORT LOGS
# ============================================================

@router.get("/logs/export")
def export_logs(
    level: str = Query("all"),
    search: str | None = Query(None),
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)

    if level and level.lower() != "all":
        query = query.filter(
            AuditLog.level == level.lower()
        )

    if search and search.strip():
        search_term = f"%{search.strip()}%"

        query = query.filter(
            AuditLog.action.ilike(search_term)
            | AuditLog.details.ilike(search_term)
            | AuditLog.username.ilike(search_term)
        )

    logs = (
        query
        .order_by(AuditLog.timestamp.desc())
        .all()
    )

    output = io.StringIO()

    writer = csv.writer(output)

    writer.writerow([
        "Timestamp",
        "User",
        "Level",
        "Action",
        "Details",
    ])

    for log in logs:
        writer.writerow([
            log.timestamp.isoformat()
            if log.timestamp
            else "",
            log.username or "System",
            log.level,
            log.action,
            log.details or "",
        ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                "attachment; filename=system_logs.csv"
            )
        },
    )


# ============================================================
# CREATE TEST / MANUAL LOG
# ============================================================

@router.post("/logs")
def create_log(
    payload: dict,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    level = payload.get("level", "info")

    if level not in {"info", "warning", "error"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid log level",
        )

    action = payload.get("action")

    if not action:
        raise HTTPException(
            status_code=400,
            detail="Action is required",
        )

    create_audit_log(
        db=db,
        admin=admin,
        action=action,
        details=payload.get("details"),
        level=level,
    )

    db.commit()

    return {
        "status": "success",
    }

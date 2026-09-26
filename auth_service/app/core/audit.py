from sqlalchemy.orm import Session

from app.models.system import AuditLog


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
    db.flush()

    return log
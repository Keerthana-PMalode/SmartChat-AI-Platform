from app.models.audit import FileAccessLog


def create_audit_log(
    db,
    file_id,
    user_id,
    action,
    ip_address=None,
    user_agent=None,
    share_link_id=None,
    access_method="AUTHENTICATED",
):
    if access_method == "AUTHENTICATED":
        if user_id is None:
            raise ValueError(
                "Authenticated audit logs require user_id"
            )

        if share_link_id is not None:
            raise ValueError(
                "Authenticated audit logs cannot have share_link_id"
            )

    elif access_method == "SHARE_LINK":
        if user_id is not None:
            raise ValueError(
                "Share-link audit logs must not have user_id"
            )

        if share_link_id is None:
            raise ValueError(
                "Share-link audit logs require share_link_id"
            )

    else:
        raise ValueError(
            f"Unsupported access method: {access_method}"
        )

    log = FileAccessLog(
        file_id=file_id,
        user_id=user_id,
        share_link_id=share_link_id,
        access_method=access_method,
        action=action,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.add(log)
    db.commit()

    return log
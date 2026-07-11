from app.models.audit import FileAccessLog



def create_audit_log(

    db,

    file_id,

    user_id,

    action,

    ip_address=None,

    user_agent=None

):


    log = FileAccessLog(

        file_id=file_id,

        user_id=user_id,

        action=action,

        ip_address=ip_address,

        user_agent=user_agent

    )


    db.add(log)

    db.commit()


    return log
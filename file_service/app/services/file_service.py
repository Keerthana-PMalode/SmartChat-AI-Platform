import hashlib
import os
import uuid

from app.core.storage import save_encrypted_file
from app.models.file import File
from app.models.permission import FilePermission
from app.services.audit_service import create_audit_log
from app.core.encryption import (
    encrypt_file,
    encrypt_key,
    generate_key,
)
from app.models.encryption_key import EncryptionKey


def get_user_files(db, user_id):

    return (
        db.query(File)
        .filter(File.owner_id == user_id)
        .order_by(File.uploaded_at.desc())
        .all()
    )


def delete_file(db, file_id, owner_id):

    record = (
        db.query(File)
        .filter(
            File.id == file_id,
            File.owner_id == owner_id,
        )
        .first()
    )

    if not record:
        return None

    # Delete the physical encrypted file
    if record.storage_path and os.path.exists(record.storage_path):
        os.remove(record.storage_path)

    # Audit the deletion before removing the database record
    create_audit_log(
        db,
        record.id,
        owner_id,
        "DELETE",
    )

    # Delete the database record
    db.delete(record)
    db.commit()

    return record


def share_file(db, file_id, owner_id, shared_user_id, permission):

    record = FilePermission(
        file_id=file_id,
        shared_with_user_id=shared_user_id,
        permission=permission,
        shared_by=owner_id,
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    # Audit the share action
    create_audit_log(db, file_id, owner_id, "SHARE")

    return record


def upload_file(db, uploaded_file, owner_id):

    content = uploaded_file["content"]
    original_name = uploaded_file["filename"]

    key = generate_key()

    encrypted_data = encrypt_file(content, key)

    encrypted_name = f"{uuid.uuid4()}.enc"

    storage_path = save_encrypted_file(
        encrypted_name,
        encrypted_data,
    )

    file_hash = hashlib.sha256(content).hexdigest()

    wrapped_key = encrypt_key(key)

    record = File(
        owner_id=owner_id,
        original_filename=original_name,
        encrypted_filename=encrypted_name,
        file_size=len(content),
        mime_type=uploaded_file["content_type"],
        encryption_algorithm="Fernet+WrappedKey",
        storage_path=storage_path,
        file_hash=file_hash,
    )

    db.add(record)

    # Obtain the generated files.id before creating the key record.
    db.flush()

    key_record = EncryptionKey(
        file_id=record.id,
        encrypted_key=wrapped_key.decode(),
        key_algorithm="Fernet",
    )

    db.add(key_record)

    db.commit()
    db.refresh(record)

    # Audit the upload action
    create_audit_log(
        db,
        record.id,
        owner_id,
        "UPLOAD",
    )

    return record

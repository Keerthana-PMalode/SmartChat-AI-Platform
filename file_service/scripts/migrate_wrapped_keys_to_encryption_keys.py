import os
import sys

sys.path.insert(
    0,
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
)

from app.core.database import SessionLocal
from app.models.file import File
from app.models.encryption_key import EncryptionKey


def migrate_wrapped_keys():
    db = SessionLocal()

    try:
        files = (
            db.query(File)
            .filter(File.encryption_algorithm == "Fernet+WrappedKey")
            .all()
        )

        print(f"Found {len(files)} wrapped-key file(s).")

        if not files:
            print("Nothing to migrate.")
            return

        migrated = 0

        for file_record in files:
            print(
                f"Processing file ID={file_record.id} "
                f"filename={file_record.original_filename}"
            )

            existing = (
                db.query(EncryptionKey)
                .filter(EncryptionKey.file_id == file_record.id)
                .first()
            )

            if existing:
                print(
                    f"  EncryptionKey already exists "
                    f"for file ID={file_record.id}; skipping."
                )
                continue

            if not file_record.encryption_key:
                raise ValueError(
                    f"File ID={file_record.id} has no encryption_key."
                )

            # IMPORTANT:
            # The value is already wrapped with FILE_MASTER_KEY.
            # Do NOT call encrypt_key() again.
            wrapped_key = file_record.encryption_key

            encryption_key = EncryptionKey(
                file_id=file_record.id,
                encrypted_key=wrapped_key,
                key_algorithm="Fernet+WrappedKey",
            )

            db.add(encryption_key)

            migrated += 1

        db.flush()

        print()
        print("Verifying migrated records...")

        for file_record in files:
            key_record = (
                db.query(EncryptionKey)
                .filter(EncryptionKey.file_id == file_record.id)
                .first()
            )

            if not key_record:
                raise RuntimeError(
                    f"Verification failed for file ID={file_record.id}"
                )

            if key_record.encrypted_key != file_record.encryption_key:
                raise RuntimeError(
                    f"Key mismatch for file ID={file_record.id}"
                )

        db.commit()

        print()
        print(f"Successfully migrated {migrated} encryption key(s).")

    except Exception as e:
        db.rollback()

        print()
        print("Migration failed.")
        print(f"Error: {e}")
        print("All database changes have been rolled back.")

        raise

    finally:
        db.close()


if __name__ == "__main__":
    migrate_wrapped_keys()
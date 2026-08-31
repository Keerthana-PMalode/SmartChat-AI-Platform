import os
import sys

sys.path.insert(
    0,
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
)

from app.core.database import SessionLocal
from app.core.encryption import encrypt_key
from app.models.file import File


def migrate_encryption_keys():

    db = SessionLocal()

    try:

        files = db.query(File).filter(File.encryption_algorithm == "Fernet").all()

        print(f"Found {len(files)} legacy file(s) to migrate.")

        if not files:
            print("Nothing to migrate.")
            return

        migrated = 0

        for file_record in files:

            print(
                f"Migrating file ID={file_record.id} "
                f"filename={file_record.original_filename}"
            )

            # Existing database value is currently the plaintext
            # Fernet file key.
            plaintext_key = file_record.encryption_key.encode()

            # Wrap the file key using FILE_MASTER_KEY.
            wrapped_key = encrypt_key(plaintext_key)

            # Replace plaintext key with wrapped key.
            file_record.encryption_key = wrapped_key.decode()

            # Mark the record as using the new key-protection scheme.
            file_record.encryption_algorithm = "Fernet+WrappedKey"

            migrated += 1

        db.commit()

        print()
        print(f"Successfully migrated {migrated} file(s).")

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

    migrate_encryption_keys()

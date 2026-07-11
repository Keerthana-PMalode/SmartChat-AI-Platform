import sys

from app.core.database import SessionLocal
from app.models.user import User
from app.core.auth import hash_password

db = SessionLocal()

if len(sys.argv) < 3:
    print("Usage:")
    print("python scripts/seed_user.py <username> <password> [role]")
    sys.exit(1)

username = sys.argv[1]
password = sys.argv[2]
role = sys.argv[3] if len(sys.argv) > 3 else "user"

existing_user = db.query(User).filter(User.username == username).first()

if existing_user:
    print(f"User '{username}' already exists.")
    sys.exit(0)

user = User(
    username=username,
    hashed_password=hash_password(password),
    role=role
)

db.add(user)
db.commit()

print(f"User '{username}' created successfully.")
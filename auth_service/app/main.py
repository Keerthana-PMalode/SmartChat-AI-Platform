from fastapi import FastAPI

from app.core.database import Base, engine
from fastapi.middleware.cors import CORSMiddleware

# Import models before create_all()
from app.models.user import User
from app.models.chat import ChatHistory

from app.routes.login import router as login_router
from app.routes.token import router as token_router
from app.routes import chat
from app.routes.admin import router as admin_router

app = FastAPI(
    title="Auth Service",
    version="1.0.0",
    root_path="/auth"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


app.include_router(login_router)
app.include_router(token_router)
app.include_router(chat.router, tags=["Chat"])
app.include_router(admin_router, prefix="/admin", tags=["Admin"])
import os


class Settings:

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql://chatbot:chatbot@localhost:5432/chatbot"
    )


settings = Settings()

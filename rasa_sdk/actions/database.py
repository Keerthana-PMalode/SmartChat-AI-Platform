import os

import psycopg2


def get_connection():

    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "postgres"),
        database=os.getenv("POSTGRES_DB", "chatbot"),
        user=os.getenv("POSTGRES_USER", "chatbot"),
        password=os.getenv("POSTGRES_PASSWORD", "chatbot"),
        port=os.getenv("POSTGRES_PORT", "5432"),
    )

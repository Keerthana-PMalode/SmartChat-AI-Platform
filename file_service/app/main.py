from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from .api import download, files, sharing, upload
from .core.database import get_db
from fastapi.openapi.docs import get_swagger_ui_html


app = FastAPI(
    title="SmartChat File Service API",
    description="API documentation for SmartChat File Service",
    version="1.0.0",
    docs_url=None,
    openapi_url="/openapi.json"
)

app.include_router(upload.router, prefix="/files", tags=["Files"])

app.include_router(files.router, prefix="/files", tags=["Files"])

app.include_router(download.router, prefix="/files", tags=["Files"])

app.include_router(sharing.router, prefix="/files", tags=["Sharing"])


@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui():
    return get_swagger_ui_html(
        openapi_url="/files/openapi.json",
        title="SmartChat File Service API",
        swagger_ui_parameters={
            "persistAuthorization": True
        }
    )


@app.get("/")
def root():
    return {
        "service": "File Encryption Service",
        "status": "running"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/health/db")
def database_health(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("SELECT 1"))

        return {
            "database": "connected",
            "result": result.scalar()
        }

    except Exception as e:
        return {
            "database": "failed",
            "error": str(e)
        }
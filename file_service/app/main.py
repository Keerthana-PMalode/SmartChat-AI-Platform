from fastapi import FastAPI, Depends

from sqlalchemy import text
from sqlalchemy.orm import Session

from .core.database import get_db
from .api import upload
from .api import files
from .api import download
from .api import sharing

app = FastAPI(

    title="File Service",

    version="1.0.0"

)

app.include_router(
    upload.router,
    prefix="/files",
    tags=["files"]
)

app.include_router(
    files.router,
    prefix="/files",
    tags=["Files"]
)

app.include_router(
    download.router,
    prefix="/files",
    tags=["Files"]
)

app.include_router(
    sharing.router,
    prefix="/files",
    tags=["Sharing"]
)

@app.get("/")
def root():

    return {

        "service":
        "File Encryption Service",

        "status":
        "running"

    }



@app.get("/health")
def health():

    return {

        "status":
        "healthy"

    }



@app.get("/health/db")
def database_health(
    db: Session = Depends(get_db)
):

    try:

        result = db.execute(
            text("SELECT 1")
        )


        return {

            "database":
            "connected",

            "result":
            result.scalar()

        }


    except Exception as e:


        return {

            "database":
            "failed",

            "error":
            str(e)

        }
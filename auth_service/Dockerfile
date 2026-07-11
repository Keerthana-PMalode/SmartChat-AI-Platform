FROM python:3.10-slim

WORKDIR /app

# Copy everything into the container
COPY . /app

# Ensure PYTHONPATH points to /app
ENV PYTHONPATH=/app

# Overwrite Alembic's env.py with your updated version
COPY env.py /app/alembic/env.py

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Start the FastAPI app with Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]



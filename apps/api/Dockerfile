FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir .

# Cloud Run injects PORT.
ENV PORT=8080
EXPOSE 8080

CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}

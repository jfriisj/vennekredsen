FROM python:3.9-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY requirements.txt requirements.txt

RUN uv pip install --system --no-cache -r requirements.txt

COPY . .

CMD ["python", "app.py"]
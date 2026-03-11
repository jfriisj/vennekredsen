FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir uv \
	&& uv pip install --system --no-cache -r requirements.txt

COPY . .

CMD ["python", "app.py"]

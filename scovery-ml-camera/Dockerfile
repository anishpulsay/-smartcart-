FROM python:3.9-slim

# Install system dependencies for OpenCV and other packages
RUN apt-get update && apt-get install -y libglib2.0-0 libsm6 libxext6 libxrender-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Hugging Face Spaces require port 7860
EXPOSE 7860

CMD ["python", "app.py"]

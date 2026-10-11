# Multi-stage optimized Dockerfile for Sparsh AI Backend
FROM python:3.11-slim

# Set environment variables for low-memory cloud container (Render 512MB RAM limit)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8000 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    TORCH_NUM_THREADS=1

WORKDIR /app

# Install system dependencies for OpenCV and MediaPipe (including OpenGL/EGL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libegl1 \
    libgles2 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install CPU-optimized lightweight PyTorch + packages
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code including bundled models
COPY . /app/

# Expose backend port (Render dynamically sets $PORT, default 8000)
EXPOSE 8000 10000

# Start Uvicorn server dynamically binding to Render's assigned $PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]

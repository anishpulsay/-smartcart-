#!/bin/bash
# ==============================================================================
# Scovery SmartCart - Raspberry Pi Camera Launcher & Auto-Environment Fixer
# ==============================================================================
cd /home/pi123/scovery-ml-camera || { echo "[ERROR] Directory not found!"; exit 1; }

# Check for any virtual environments and activate if they exist
for venv in /home/pi123/venv /home/pi123/.venv /home/pi123/scovery-ml-camera/venv /home/pi123/scovery-ml-camera/.venv /home/pi123/env; do
    if [ -f "$venv/bin/activate" ]; then
        echo "[INFO] Activating virtual environment: $venv"
        source "$venv/bin/activate"
        break
    fi
done

# Check if cv2 and requests are available with current python3
if ! python3 -c "import cv2, requests" 2>/dev/null; then
    echo "[WARNING] Required modules (cv2/requests) not found in $(which python3)!"
    echo "[INFO] Automatically installing python3-opencv and python3-requests on Raspberry Pi..."
    if command -v apt-get >/dev/null; then
        echo "[INFO] Running: sudo apt-get update && sudo apt-get install -y python3-opencv python3-requests"
        sudo apt-get update && sudo apt-get install -y python3-opencv python3-requests || python3 -m pip install opencv-python requests --break-system-packages || python3 -m pip install opencv-python requests
    else
        python3 -m pip install opencv-python requests --break-system-packages || python3 -m pip install opencv-python requests
    fi
fi

# Final verification
if ! python3 -c "import cv2, requests" 2>/dev/null; then
    echo "[ERROR] Could not import cv2 or requests. Please run: sudo apt-get install -y python3-opencv python3-requests on your Pi." | tee /home/pi123/camera_stream.log
    exit 1
fi

echo "[INFO] Stopping any existing camera streamer processes..."
pkill -9 -f pi_stream_cached.py 2>/dev/null || true

echo "[INFO] Preparing log file..."
touch /home/pi123/camera_stream.log
chmod 666 /home/pi123/camera_stream.log

echo "[INFO] Launching python3 -u pi_stream_cached.py in background..."
nohup python3 -u pi_stream_cached.py > /home/pi123/camera_stream.log 2>&1 < /dev/null &
PID=$!
echo "[SUCCESS] Camera streamer running with PID $PID using $(which python3)"

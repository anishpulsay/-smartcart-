#!/bin/bash
# ==============================================================================
# Scovery SmartCart - Raspberry Pi Load Cell & Scale Launcher & Auto-Environment Fixer
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

# Check if hx711 and requests are available with current python3
if ! python3 -c "import hx711, requests" 2>/dev/null; then
    echo "[WARNING] Required modules (hx711/requests) not found in $(which python3)!"
    echo "[INFO] Automatically installing hx711 and requests on Raspberry Pi..."
    python3 -m pip install hx711 requests RPi.GPIO --break-system-packages 2>/dev/null || python3 -m pip install hx711 requests RPi.GPIO || {
        echo "[INFO] Attempting git install of hx711py..."
        python3 -m pip install git+https://github.com/tatobari/hx711py.git --break-system-packages 2>/dev/null || python3 -m pip install git+https://github.com/tatobari/hx711py.git
    }
fi

# Final verification
if ! python3 -c "import hx711" 2>/dev/null; then
    echo "[WARNING] Physical hx711 module still not loaded. The script will automatically fall back to Simulation/Manual mode if run directly."
fi

# Check arguments
if [ "$1" = "--calibrate" ]; then
    echo "[INFO] Launching interactive Calibration Wizard using $(which python3)..."
    exec python3 -u pi_scale.py --calibrate
elif [ "$1" = "--simulate" ]; then
    echo "[INFO] Launching interactive Simulator using $(which python3)..."
    exec python3 -u pi_scale.py --simulate
elif [ "$1" = "--monitor" ]; then
    echo "[INFO] Launching live terminal weight monitor using $(which python3)..."
    exec python3 -u pi_scale.py --monitor
elif [ "$1" = "--doctor" ]; then
    echo "[INFO] Launching HX711 Hardware Doctor using $(which python3)..."
    exec python3 -u pi_scale_doctor.py
else
    echo "[INFO] Stopping any existing scale service processes..."
    pkill -9 -f pi_scale.py 2>/dev/null || true

    echo "[INFO] Preparing log file..."
    touch /home/pi123/scale_service.log
    chmod 666 /home/pi123/scale_service.log

    echo "[INFO] Launching python3 -u pi_scale.py in background..."
    nohup python3 -u pi_scale.py > /home/pi123/scale_service.log 2>&1 < /dev/null &
    PID=$!
    echo "[SUCCESS] Load Cell scale service running with PID $PID using $(which python3)"
fi

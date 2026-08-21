import cv2
import requests
import time
import os
import threading
from pathlib import Path

# =========================================================================
# CONFIGURATION - UPDATE THIS WITH YOUR WINDOWS PC IP ADDRESS!
# Example: If your Windows PC IP is 192.168.1.45, set below:
# =========================================================================
PC_SERVER_IP = "Anishs-MacBook-Air.local"  # <-- Mac Hostname
SERVER_URL = "http://Anishs-MacBook-Air.local:7860/predict"

CAMERA_INDEX = 0             # 0 for first USB webcam connected to Pi
CACHE_DIR = Path("offline_cache")
MAX_CACHE_FILES = 500        # Cap at 500 frames (~7.5 MB total) so 16GB SD card never fills up
OFFLINE_SAMPLE_INTERVAL = 1.5 # While offline, only capture 1 frame every 1.5s

# Ensure cache folder exists on SD card
CACHE_DIR.mkdir(exist_ok=True)

class OfflineCacheManager:
    def __init__(self, cache_dir, server_url):
        self.cache_dir = cache_dir
        self.server_url = server_url
        self.is_online = True
        self.syncing = False

    def save_to_cache(self, frame_bytes):
        """Saves frame to SD card with timestamp filename, maintaining FIFO limit."""
        try:
            files = sorted(self.cache_dir.glob("*.jpg"), key=os.path.getmtime)
            # If cache exceeds limit, delete oldest frame to protect SD card space
            while len(files) >= MAX_CACHE_FILES:
                oldest = files.pop(0)
                oldest.unlink(missing_ok=True)

            # Save new frame
            filename = self.cache_dir / f"scan_{int(time.time() * 1000)}.jpg"
            with open(filename, "wb") as f:
                f.write(frame_bytes)
            print(f"[OFFLINE CACHE] Saved frame -> {filename.name} (Total cached: {len(files) + 1}/{MAX_CACHE_FILES})")
        except Exception as e:
            print(f"[ERROR] Failed to write to SD card cache: {e}")

    def sync_background(self):
        """Background thread that uploads cached frames when Wi-Fi returns."""
        if self.syncing:
            return
        self.syncing = True

        files = sorted(self.cache_dir.glob("*.jpg"), key=os.path.getmtime)
        if files:
            print(f"\n[SYNC] 🌐 Wi-Fi connection restored! Uploading {len(files)} offline frames to PC...")

        for file_path in files:
            try:
                with open(file_path, "rb") as f:
                    data = f.read()
                
                # Send with X-Offline-Sync header
                res = requests.post(
                    self.server_url, 
                    data=data, 
                    headers={'Content-Type': 'image/jpeg', 'X-Offline-Sync': 'true'}, 
                    timeout=1.5
                )
                
                if res.status_code == 200:
                    file_path.unlink(missing_ok=True) # Delete from SD card once successfully synced
                    time.sleep(0.08) # Small spacing to not flood PC
                else:
                    break # Stop sync if server error occurs
            except requests.RequestException:
                self.is_online = False
                break # Network dropped again during sync, pause uploading

        self.syncing = False
        print("[SYNC] Offline queue upload completed.")

def main():
    print("=========================================================")
    print(f"📡 Raspberry Pi Smart Camera Streaming to: {SERVER_URL}")
    print("=========================================================")
    
    # When a USB camera is unplugged and reconnected on Linux/Raspberry Pi,
    # the kernel reassigns it from /dev/video0 to /dev/video1 or /dev/video2.
    # We dynamically check /dev/video0 through /dev/video9 on Linux, sorted by
    # most recently modified timestamp, so your freshly plugged webcam is tested first!
    if os.name == 'posix':
        posix_indices = []
        for i in range(10):
            dev_path = f"/dev/video{i}"
            if os.path.exists(dev_path):
                try:
                    posix_indices.append((i, os.path.getmtime(dev_path)))
                except OSError:
                    posix_indices.append((i, 0))
        posix_indices.sort(key=lambda x: x[1], reverse=True)
        discovered = [item[0] for item in posix_indices]
        indices_to_try = discovered + [idx for idx in range(10) if idx not in discovered]
    else:
        indices_to_try = [CAMERA_INDEX] + [idx for idx in [0, 1, 2, 3, 4] if idx != CAMERA_INDEX]
    cap = None
    connected_idx = None

    for idx in indices_to_try:
        print(f"[INFO] Attempting to open camera index {idx}...")
        # Try Video4Linux2 (V4L2) backend first on Linux/Pi to avoid FFMPEG warnings
        backends = [cv2.CAP_V4L2, cv2.CAP_ANY] if os.name == 'posix' else [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
        for backend in backends:
            temp_cap = cv2.VideoCapture(idx, backend)
            if temp_cap.isOpened():
                temp_cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                temp_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                # Test reading a frame to verify it is an active camera feed and not a metadata node
                ret, frame = temp_cap.read()
                if ret and frame is not None and frame.size > 0:
                    cap = temp_cap
                    connected_idx = idx
                    print(f"[SUCCESS] Connected to camera index {connected_idx}!")
                    break
            temp_cap.release()
        if cap is not None:
            break

    if cap is None or not cap.isOpened():
        print(f"\n[ERROR] Could not open camera across indices {indices_to_try}.")
        print("[TROUBLESHOOTING TIPS FOR RASPBERRY PI]:")
        print("1. Re-plugging a USB webcam often shifts the device node (e.g. /dev/video0 -> /dev/video2).")
        print("2. Check available video devices on your Pi terminal by running: ls -l /dev/video*")
        print("3. Ensure user has video permissions: sudo usermod -a -G video $USER")
        print("4. If the camera is locked by another script, kill old Python processes: sudo pkill -9 -f python")
        return

    cache_mgr = OfflineCacheManager(CACHE_DIR, SERVER_URL)
    last_offline_save = 0

    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            time.sleep(0.1)
            continue

        # Compress frame to JPEG (~15 KB)
        _, img_encoded = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        frame_bytes = img_encoded.tobytes()

        try:
            # Send live frame to PC over Wi-Fi (0.4s timeout ensures zero camera lag if Wi-Fi drops)
            res = requests.post(
                SERVER_URL, 
                data=frame_bytes, 
                headers={'Content-Type': 'image/jpeg'}, 
                timeout=0.4
            )
            
            if res.status_code == 200:
                # We are ONLINE
                if not cache_mgr.is_online:
                    print("\n[INFO] 🟢 Network reconnected!")
                    cache_mgr.is_online = True
                
                # If we have offline files on SD card, start background sync thread
                if any(CACHE_DIR.glob("*.jpg")) and not cache_mgr.syncing:
                    threading.Thread(target=cache_mgr.sync_background, daemon=True).start()

                # Print prediction response from PC
                data = res.json()
                if data.get("detected"):
                    print(f"✨ [DETECTED] {data['item']} ({data['confidence']*100:.1f}%)")
                time.sleep(0.04)  # Rate limit to ~25 FPS to keep Wi-Fi smooth and lag-free

        except (requests.ConnectionError, requests.Timeout):
            # We are OFFLINE
            if cache_mgr.is_online:
                print("\n[WARNING] 🔴 Lost Wi-Fi connection to PC Server! Switching to Offline SD Cache...")
                cache_mgr.is_online = False

            # Throttled offline saving: Save 1 frame every 1.5 seconds so SD card doesn't overflow
            now = time.time()
            if now - last_offline_save >= OFFLINE_SAMPLE_INTERVAL:
                cache_mgr.save_to_cache(frame_bytes)
                last_offline_save = now

        # ~20 FPS loop
        time.sleep(0.05)

    cap.release()

if __name__ == "__main__":
    main()

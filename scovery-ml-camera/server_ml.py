import cv2
import numpy as np
import time
import os
import requests
from flask import Flask, request, jsonify
from ultralytics import YOLO

app = Flask(__name__)

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Offline-Sync'
    return response

# Try to load custom trained model first, otherwise fallback to default
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATHS = [
    os.path.join(BASE_DIR, "runs/classify/train/weights/best.pt"),
    "scovery-ml-camera/runs/classify/train/weights/best.pt",
    "runs/classify/train/weights/best.pt",
    os.path.join(BASE_DIR, "models/best.pt"),
    "yolov8n-cls.pt"
]

model_path = None
for path in MODEL_PATHS:
    if os.path.exists(path):
        model_path = path
        break

if not model_path:
    print("[WARNING] No custom weights found. Using default yolov8n-cls.pt...")
    model_path = "yolov8n-cls.pt"

print(f"[INFO] Loading YOLO Model on PC Server from: {model_path}")
model = YOLO(model_path)
print(f"✨ [SUCCESS] Loaded Custom Trained AI Model with classes: {list(model.names.values())[:10]}...")

# Node.js backend endpoint where detected scans are added
NODE_API_URL = "http://localhost:3001/api/camera_scans"

# Debounce tracking so holding an item doesn't spam 50 items per second
last_sent_time = {}
DEBOUNCE_SECONDS = 3.0
CONFIDENCE_THRESHOLD = 0.70

# Global variable for live streaming with clean initial placeholder
import threading
inference_lock = threading.Lock()

placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
placeholder[:] = (26, 20, 50)
cv2.putText(placeholder, "Scovery SmartCart Camera", (140, 210), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 214, 143), 2)
cv2.putText(placeholder, "Waiting for Raspberry Pi Stream...", (150, 260), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 1)
latest_annotated_frame = placeholder
last_frame_timestamp = 0

@app.route('/predict', methods=['POST'])
def predict():
    global latest_annotated_frame, last_frame_timestamp
    try:
        # Check if frame came from Pi's offline cache sync
        is_offline_sync = request.headers.get('X-Offline-Sync') == 'true'

        # If model is currently processing a frame and this is a live stream, skip immediately
        # to prevent thread backlog and memory exhaustion
        if not is_offline_sync and inference_lock.locked():
            return jsonify({"status": "busy_skipping_frame"}), 200

        # Protect memory from concurrent worker threads
        if not inference_lock.acquire(timeout=0.5 if is_offline_sync else 0.05):
            return jsonify({"status": "busy_skipping_frame"}), 200

        try:
            data = request.get_data()
            if not data or len(data) == 0:
                return jsonify({"error": "Empty request body"}), 400

            nparr = np.frombuffer(data, np.uint8)
            if nparr.size == 0:
                return jsonify({"error": "Empty image buffer"}), 400

            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                return jsonify({"error": "Invalid image format"}), 400

            # Run ultra-fast inference on PC (<10-15ms)
            results = model(frame, verbose=False)[0]
            top1_idx = results.probs.top1
            confidence = results.probs.top1conf.item()
            class_name = results.names[top1_idx]

            now = time.time()
            detected = False

            # Annotate frame for live display (/video_feed & main thread GUI)
            annotated = frame.copy()
            color = (0, 255, 143) if confidence > CONFIDENCE_THRESHOLD else (0, 165, 255)
            
            # Draw sleek top header banner on video frame
            cv2.rectangle(annotated, (0, 0), (640, 50), (16, 16, 36), -1)
            label_text = f"DETECTED: {class_name.upper()} ({confidence*100:.1f}%)"
            if is_offline_sync:
                label_text = f"[SD OFFLINE RECOVERY] {label_text}"
            cv2.putText(annotated, label_text, (15, 33), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            
            # Draw bottom branding
            cv2.putText(annotated, "Scovery SmartCart ML Stream | Zero-Latency Pi Feed", (15, annotated.shape[0] - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

            # Update global frame safely inside lock
            latest_annotated_frame = annotated
            last_frame_timestamp = time.time()
        finally:
            inference_lock.release()

        if confidence > CONFIDENCE_THRESHOLD:
            # Check debounce timer (unless it's an offline recovery frame)
            if class_name not in last_sent_time or (now - last_sent_time[class_name]) > DEBOUNCE_SECONDS or is_offline_sync:
                print(f"[PC DETECTED{' (OFFLINE RECOVERY)' if is_offline_sync else ''}] {class_name} ({confidence*100:.1f}%)")
                
                # Send detected item to React SmartCart backend!
                payload = {
                    "item_name": class_name,
                    "quantity": 1,
                    "confidence": round(confidence * 100, 1),
                    "offline_recovered": is_offline_sync,
                    "timestamp": now
                }
                try:
                    requests.post(NODE_API_URL, json=payload, timeout=2.0)
                except Exception as e:
                    print(f"[ERROR] Could not forward to Node.js backend at {NODE_API_URL}: {e}")

                last_sent_time[class_name] = now
                detected = True

        return jsonify({
            "detected": detected,
            "item": class_name,
            "confidence": confidence
        }), 200

    except Exception as e:
        print(f"[ERROR] Prediction error: {e}")
        return jsonify({"error": str(e)}), 500

def get_display_frame():
    global latest_annotated_frame, last_frame_timestamp, placeholder
    if time.time() - last_frame_timestamp > 4.0 and last_frame_timestamp > 0:
        disc = np.zeros((480, 640, 3), dtype=np.uint8)
        disc[:] = (26, 20, 50)
        cv2.putText(disc, "Scovery SmartCart Camera", (140, 190), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 214, 143), 2)
        cv2.putText(disc, "🔴 Raspberry Pi Stream Disconnected / Paused", (90, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 165, 255), 2)
        cv2.putText(disc, "Ensure `pi_stream_cached.py` is running on your Pi!", (110, 280), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)
        return disc
    elif last_frame_timestamp == 0:
        return placeholder
    else:
        return latest_annotated_frame

def generate_video_stream():
    while True:
        frame = get_display_frame()
        if frame is not None:
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.05)

@app.route('/video_feed')
def video_feed():
    from flask import Response
    return Response(generate_video_stream(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    print("=========================================================")
    print("🚀 PC ML Inference Server Running on http://0.0.0.0:5000")
    print("=========================================================")
    
    server_thread = threading.Thread(target=lambda: app.run(host='0.0.0.0', port=5000, threaded=True), daemon=False)
    server_thread.start()
    
    try:
        while True:
            try:
                frame = get_display_frame()
                if frame is not None:
                    cv2.imshow("Scovery PC Live ML Camera Stream", frame)
                key = cv2.waitKey(30) & 0xFF
                if key == ord('q'):
                    break
            except Exception:
                time.sleep(0.1)
            time.sleep(0.03)
    except KeyboardInterrupt:
        pass

import cv2
import os
import numpy as np
import time
from ultralytics import YOLO
from config import CAMERA_INDEX, CONFIDENCE_THRESHOLD
from api import send_item_to_backend

def main():
    print("[INFO] Loading custom YOLO Classification model...")
    try:
        model = YOLO("runs/classify/train/weights/best.pt")
    except Exception as e:
        print(f"[ERROR] Could not load custom model: {e}")
        print("Please ensure the training script ran successfully first!")
        return

    print("[INFO] Starting video stream...")
    cap = None
    
    # IP Camera bypass for wireless smartphone connection
    if isinstance(CAMERA_INDEX, str):
        print(f"[INFO] Connecting to Phone IP Camera: {CAMERA_INDEX}")
        cap = cv2.VideoCapture(CAMERA_INDEX)
        if not cap.isOpened():
            print("[ERROR] Could not connect to Phone Camera IP. Check URL and WiFi.")
            return
    else:
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
        elif isinstance(CAMERA_INDEX, int):
            indices_to_try = [CAMERA_INDEX] + [i for i in [0, 1, 2, 3, 4] if i != CAMERA_INDEX]
        else:
            indices_to_try = [0, 1, 2, 3, 4]
        
        backends = [cv2.CAP_V4L2, cv2.CAP_ANY] if os.name == 'posix' else [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
        for idx in indices_to_try:
            for backend in backends:
                cap = cv2.VideoCapture(idx, backend)
                if cap.isOpened():
                    for _ in range(5):  # Buffer frames
                        ret, frame = cap.read()
                    if ret and np.mean(frame) > 1.0:
                        print(f"[INFO] Successfully connected to valid camera feed {idx}!")
                        break
                cap.release()
                cap = None
            if cap is not None:
                 break
                 
        if cap is None:
            print(f"[ERROR] Could not open camera {CAMERA_INDEX}. Windows is blocking access or index is invalid.")
            return

    time.sleep(2.0)

    last_sent_time = {}
    DEBOUNCE_SECONDS = 5

    while True:
        ret, frame = cap.read()
        if not ret or frame is None or frame.size == 0:
            break
        
        # Classification models work best on square images.
        # We crop the center of the webcam feed to be our "scan zone".
        h, w = frame.shape[:2]
        crop_size = min(h, w)
        startY = h//2 - crop_size//2
        startX = w//2 - crop_size//2
        crop = frame[startY:startY+crop_size, startX:startX+crop_size]

        # Draw a scanning target box
        cv2.rectangle(frame, (startX, startY), (startX+crop_size, startY+crop_size), (0, 255, 0), 2)
        cv2.putText(frame, "Scan Zone", (startX + 10, startY + 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        # Run inference on the center square
        results = model(crop, verbose=False)
        result = results[0]
        
        # We get the top highest probability item
        top1_idx = result.probs.top1
        confidence = result.probs.top1conf.item()
        class_name = result.names[top1_idx]

        # DEBUG: Always show what the AI is thinking in the corner
        debug_label = f"AI Thinking: {class_name} ({confidence*100:.1f}%)"
        cv2.putText(frame, debug_label, (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)

        if confidence > CONFIDENCE_THRESHOLD:
            current_time = time.time()
            if class_name not in last_sent_time or (current_time - last_sent_time[class_name]) > DEBOUNCE_SECONDS:
                print(f"[DETECTED] {class_name} ({confidence*100:.1f}%)")
                send_item_to_backend(class_name)
                last_sent_time[class_name] = current_time

            label = f"{class_name}: {confidence * 100:.1f}%"
            cv2.putText(frame, label, (startX, startY - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        else:
             # Just log it to terminal for us to see
             if confidence > 0.1: # Only log if reasonably sure
                 print(f"[DEBUG] low confidence: {class_name} ({confidence*100:.1f}%)")

        # Show the whole frame
        cv2.imshow("Scovery Smart Scanner", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        try:
            if cv2.getWindowProperty("Scovery Smart Scanner", cv2.WND_PROP_VISIBLE) < 1:
                break
        except Exception:
            pass

    print("[INFO] Cleaning up...")
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()

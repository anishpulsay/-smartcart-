from ultralytics import YOLO

if __name__ == '__main__':
    print("[INFO] Loading YOLOv8s (Small) Classification Model for High Confidence (70%+)...")
    # Using 'yolov8s-cls.pt' (Small) instead of 'yolov8n-cls.pt' (Nano) gives 4x more capacity
    # to distinguish 165 fine-grained Indian grocery items with high confidence!
    model = YOLO('yolov8s-cls.pt')

    print("[INFO] Starting Custom Training on ALL 165 products!")
    print("[INFO] Using 320px image size and 50 epochs for maximum confidence level...")
    
    # 50 epochs for 165 classes, 320px resolution for fine details and packaging text
    results = model.train(
        data='yolo_dataset',
        epochs=50,
        imgsz=320,
        batch=16,
        patience=8,
        workers=4,
        exist_ok=True,  # Overwrite previous training run
    )
    
    print("\n[SUCCESS] AI High-Confidence Training Finished!")
    print("Your upgraded custom weights are saved in: runs/classify/train/weights/best.pt")
    print("Next step: Run 'python server_ml.py' to start high-confidence PC detection.")

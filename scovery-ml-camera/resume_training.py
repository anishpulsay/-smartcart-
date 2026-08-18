from ultralytics import YOLO

if __name__ == '__main__':
    print("[INFO] Loading last checkpoint from runs/classify/train/weights/last.pt...")
    model = YOLO('runs/classify/train/weights/last.pt')
    
    print("[INFO] Resuming training from where it left off up to epoch 50...")
    results = model.train(resume=True)
    
    print("\n[SUCCESS] Resumed training finished!")
    print("Your updated custom weights are saved in: runs/classify/train/weights/best.pt")

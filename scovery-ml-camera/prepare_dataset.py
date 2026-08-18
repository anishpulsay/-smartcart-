import os
import shutil
import random

source_dir = 'training_dataset'
dataset_dir = 'yolo_dataset'

# Clear old dataset (it may only have 6 classes from before)
if os.path.exists(dataset_dir):
    print("[INFO] Clearing old yolo_dataset...")
    shutil.rmtree(dataset_dir)

os.makedirs(os.path.join(dataset_dir, 'train'), exist_ok=True)
os.makedirs(os.path.join(dataset_dir, 'val'), exist_ok=True)

if not os.path.exists(source_dir):
    print(f"Error: {source_dir} not found. Did the scraper finish?")
    exit(1)

IMAGE_EXTS = ('.jpg', '.png', '.jpeg', '.gif', '.bmp', '.webp')
folders = [f for f in os.listdir(source_dir) if os.path.isdir(os.path.join(source_dir, f))]
print(f"[INFO] Found {len(folders)} product folders in {source_dir}")

successful = 0
skipped = 0

for i, folder in enumerate(sorted(folders), 1):
    folder_path = os.path.join(source_dir, folder)
    images = [f for f in os.listdir(folder_path) if f.lower().endswith(IMAGE_EXTS)]
    
    if len(images) < 3:
        print(f"  [{i}/{len(folders)}] SKIP '{folder}' (only {len(images)} images)")
        skipped += 1
        continue
        
    random.shuffle(images)
    split = max(1, int(len(images) * 0.8))  # At least 1 for training
    train_imgs = images[:split]
    val_imgs = images[split:] if split < len(images) else images[:1]
    
    train_folder = os.path.join(dataset_dir, 'train', folder)
    val_folder = os.path.join(dataset_dir, 'val', folder)
    os.makedirs(train_folder, exist_ok=True)
    os.makedirs(val_folder, exist_ok=True)
    
    for img in train_imgs:
        shutil.copy(os.path.join(folder_path, img), os.path.join(train_folder, img))
    for img in val_imgs:
        shutil.copy(os.path.join(folder_path, img), os.path.join(val_folder, img))
    
    successful += 1

print(f"\n[SUCCESS] Dataset created with {successful} classes! ({skipped} skipped due to too few images)")
print(f"  Train: {dataset_dir}/train/ ({successful} folders)")
print(f"  Val:   {dataset_dir}/val/ ({successful} folders)")
print(f"\nNext step: Run 'python train_model.py' to train the model.")

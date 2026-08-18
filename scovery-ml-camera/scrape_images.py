import json
import os
import sys

# Ensure the library is installed
try:
    from bing_image_downloader import downloader
except ImportError:
    print("Please install bing-image-downloader by running: pip install bing-image-downloader")
    sys.exit(1)

# Path to your Scovery product database
DATABASE_PATH = '../server/data.json'
IMAGES_PER_PRODUCT = 30
MIN_IMAGES_THRESHOLD = 10  # Skip folders that already have enough images

print("Reading Scovery database...")
if not os.path.exists(DATABASE_PATH):
    print(f"Error: Could not find database at {DATABASE_PATH}")
    sys.exit(1)

with open(DATABASE_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

products = data.get('products', [])
if not products:
    print("No products found in the database.")
    sys.exit(1)

# Check which products already have enough images
skipped = 0
to_scrape = []
for product in products:
    name = product.get('name')
    if not name:
        continue
    folder_path = os.path.join('training_dataset', name)
    if os.path.isdir(folder_path):
        existing = [f for f in os.listdir(folder_path) if f.lower().endswith(('.jpg', '.png', '.jpeg', '.gif', '.bmp'))]
        if len(existing) >= MIN_IMAGES_THRESHOLD:
            skipped += 1
            continue
    to_scrape.append(name)

print(f"Found {len(products)} products total.")
print(f"Already scraped (>={MIN_IMAGES_THRESHOLD} images): {skipped}")
print(f"Remaining to scrape: {len(to_scrape)}")

for i, query in enumerate(to_scrape, 1):
    print(f"\n[{i}/{len(to_scrape)}] ======================================")
    print(f"Scraping '{query}'")
    print(f"======================================")
    try:
        downloader.download(
            query, 
            limit=IMAGES_PER_PRODUCT,  
            output_dir='training_dataset', 
            adult_filter_off=True, 
            force_replace=False, 
            timeout=60, 
            verbose=False
        )
    except Exception as e:
        print(f"[WARNING] Failed to scrape '{query}': {e}")

print("\n[SUCCESS] All images have been downloaded to the 'training_dataset' folder!")
print(f"Next step: Run 'python prepare_dataset.py' to split into train/val for YOLO training.")

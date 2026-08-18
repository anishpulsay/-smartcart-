import requests
import time
from config import ADD_ITEM_ENDPOINT

def send_item_to_backend(item_name):
    """
    Sends a detected item to the Scovery backend.
    """
    print(f"[API] Attempting to add '{item_name}' to cart via {ADD_ITEM_ENDPOINT}...")
    
    # We will send a basic payload first. You might need to adjust this
    # base on what the Scovery backend expects (e.g. barcode vs item name).
    payload = {
        "item_name": item_name,
        "quantity": 1,
        "timestamp": time.time()
    }
    
    try:
        response = requests.post(ADD_ITEM_ENDPOINT, json=payload, timeout=5)
        if response.status_code in [200, 201]:
            print(f"[API] Successfully added {item_name}!")
        else:
            print(f"[API] Backend returned error: {response.status_code} - {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"[API] Failed to connect to the backend. Is the server running? Error: {e}")

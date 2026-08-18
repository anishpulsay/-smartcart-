# Configuration settings for Scovery ML Camera

# Camera settings
# Use 0, 1, 2 for built-in webcams.
# Or, link your phone via WiFi stream! Example: CAMERA_INDEX = "http://192.168.1.100:8080/video"
CAMERA_INDEX = 0

# Backend API settings
# Update this URL to point to the actual IP address of the machine running the Scovery backend
BACKEND_HOST = "http://localhost:3001"
ADD_ITEM_ENDPOINT = f"{BACKEND_HOST}/api/camera_scans"

# Machine Learning settings
# With 165 classes, use a strict 70% threshold to avoid false detections and only add confident items
CONFIDENCE_THRESHOLD = 0.70

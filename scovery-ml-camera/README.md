# Scovery ML Camera (Raspberry Pi Setup)

This is a standalone Python application that captures webcam video, detects items using MobileNet SSD, and sends the detected objects to the Scovery React App's backend.

## 1. Prerequisites (On Raspberry Pi)

First, make sure you have python 3 installed, then install the dependencies:
```bash
pip install -r requirements.txt
```

## 2. Download Machine Learning Models
We are using MobileNet SSD because it runs easily on a Raspberry Pi CPU. You need to create a `models` folder and download the Caffemodel and Prototxt files:

```bash
mkdir models
cd models
wget https://raw.githubusercontent.com/djmv/MobilNet_SSD_opencv/master/MobileNetSSD_deploy.prototxt
wget https://raw.githubusercontent.com/djmv/MobilNet_SSD_opencv/master/MobileNetSSD_deploy.caffemodel
mv MobileNetSSD_deploy.prototxt MobileNetSSD_deploy.prototxt.txt
cd ..
```

## 3. Configuration
Edit `config.py` to point to the actual IP address of the machine running your Node.js backend. 
- For example: `http://192.168.1.100:3001` (Do not use `http://localhost:3001` if the backend is on a different computer!).
- You can also modify `TARGET_OBJECTS` in `config.py` to only trigger API requests for items you actually sell.

## 4. Running the Camera Script
```bash
python main.py
```

Press `q` within the image window to quit the video stream. The script will automatically filter out duplicates and send POST requests to `/api/camera_scans` when objects are detected.

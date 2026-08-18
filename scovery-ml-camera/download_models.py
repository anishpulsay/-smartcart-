import os
import urllib.request

print("Creating models directory...")
os.makedirs("models", exist_ok=True)

print("Downloading prototxt...")
urllib.request.urlretrieve("https://raw.githubusercontent.com/djmv/MobilNet_SSD_opencv/master/MobileNetSSD_deploy.prototxt", "models/MobileNetSSD_deploy.prototxt.txt")

print("Downloading caffemodel (this is ~22MB, might take a few seconds)...")
urllib.request.urlretrieve("https://raw.githubusercontent.com/djmv/MobilNet_SSD_opencv/master/MobileNetSSD_deploy.caffemodel", "models/MobileNetSSD_deploy.caffemodel")

print("Download complete!")

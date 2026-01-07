import urllib.request
import os

base_url = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
files = [
    "ssd_mobilenetv1_model-weights_manifest.json",
    "ssd_mobilenetv1_model-shard1",
    "ssd_mobilenetv1_model-shard2",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
]

dest = "public/models"
if not os.path.exists(dest):
    os.makedirs(dest)

for file in files:
    url = f"{base_url}/{file}"
    file_path = os.path.join(dest, file)
    print(f"Downloading {file}...")
    try:
        urllib.request.urlretrieve(url, file_path)
        print(f"Saved {file} ({os.path.getsize(file_path)} bytes)")
    except Exception as e:
        print(f"Error downloading {file}: {e}")

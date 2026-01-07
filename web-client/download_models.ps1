$baseUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
$files = @(
    "ssd_mobilenetv1_model-weights_manifest.json",
    "ssd_mobilenetv1_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
)

$dest = "public/models"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

foreach ($file in $files) {
    Write-Host "Downloading $file..."
    Invoke-WebRequest -Uri "$baseUrl/$file" -OutFile "$dest/$file"
}
Write-Host "Done."

import os
import shutil
from PIL import Image
from capturesync import overlay, processor

# Setup test environment in a 'test_env' folder
TEST_ROOT = "f:/CaptureSync/test_env"
SOURCE = os.path.join(TEST_ROOT, "source")
OUTPUT = os.path.join(TEST_ROOT, "output")
LANDSCAPE_OVERLAY = os.path.join(TEST_ROOT, "overlay_l.png")
PORTRAIT_OVERLAY = os.path.join(TEST_ROOT, "overlay_p.png")

def setup():
    if os.path.exists(TEST_ROOT):
        shutil.rmtree(TEST_ROOT)
    os.makedirs(SOURCE)
    os.makedirs(OUTPUT)
    
    # Create dummy overlays
    # Landscape overlay (Red semi-transparent)
    img = Image.new('RGBA', (100, 50), (255, 0, 0, 128))
    img.save(LANDSCAPE_OVERLAY)
    
    # Portrait overlay (Blue semi-transparent)
    img = Image.new('RGBA', (50, 100), (0, 0, 255, 128))
    img.save(PORTRAIT_OVERLAY)
    
    print("Test environment created.")

def test_processing():
    print("Testing processing logic...")
    
    # Create a landscape image
    l_img_path = os.path.join(SOURCE, "test_landscape.jpg")
    Image.new('RGB', (800, 600), (255, 255, 255)).save(l_img_path)
    
    # Create a portrait image
    p_img_path = os.path.join(SOURCE, "test_portrait.jpg")
    Image.new('RGB', (600, 800), (255, 255, 255)).save(p_img_path)
    
    # Mock config
    config = {
        "source_folder": SOURCE,
        "output_folder": OUTPUT,
        "landscape_overlay": LANDSCAPE_OVERLAY,
        "portrait_overlay": PORTRAIT_OVERLAY
    }
    
    # Run processor manually (bypassing watcher for now to test logic)
    print("Processing landscape image...")
    processor.process_file(l_img_path, config)
    
    print("Processing portrait image...")
    processor.process_file(p_img_path, config)
    
    # Verify results
    out_files = os.listdir(OUTPUT)
    print(f"Output files: {out_files}")
    
    expected_l = "test_landscape_processed.jpg"
    expected_p = "test_portrait_processed.jpg"
    
    if expected_l in out_files and expected_p in out_files:
        print("SUCCESS: Both files processed.")
    else:
        print("FAILURE: Missing processed files.")

def cleanup():
    # keep files for inspection if needed, or remove
    pass

if __name__ == "__main__":
    setup()
    test_processing()

import os
import time
from . import overlay
from . import uploader

# Supported extensions
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png'}

def is_image(file_path):
    return os.path.splitext(file_path)[1].lower() in IMAGE_EXTENSIONS

def wait_for_file_ready(file_path, timeout=5):
    """
    Waits until the file is fully written and accessible.
    Cameras/Lightroom might write files in chunks.
    """
    start_time = time.time()
    last_size = -1
    
    while time.time() - start_time < timeout:
        try:
            if not os.path.exists(file_path):
                return False
                
            current_size = os.path.getsize(file_path)
            
            # If size hasn't changed and is > 0, and we can open it, it's likely ready
            if current_size == last_size and current_size > 0:
                try:
                    with open(file_path, 'rb'):
                        return True
                except IOError:
                    pass
            
            last_size = current_size
            time.sleep(1)
        except Exception:
            pass
            
    return False

def process_file(file_path, config, log_callback=None):
    """
    Main processing function called when a new file is detected.
    """
    if log_callback is None:
        log_callback = print

    if not is_image(file_path):
        # Ignore non-images (Safeguard)
        return

    # Ignore processed files if they somehow end up in the source folder
    # (though user instruction implies source -> output separation)
    if "_processed" in file_path:
        return

    log_callback(f"Detected new file: {file_path}")

    # Wait for write to complete
    if not wait_for_file_ready(file_path):
        log_callback(f"Timeout waiting for file to be ready: {file_path}")
        return

    output_folder = config.get("output_folder")
    landscape_overlay = config.get("landscape_overlay")
    portrait_overlay = config.get("portrait_overlay")

    if not output_folder:
        log_callback("Configuration missing output folder. Skipping.")
        return

    if not landscape_overlay and not portrait_overlay:
         log_callback("Configuration missing overlay. Please provide at least one.")
         return

    log_callback(f"Processing {os.path.basename(file_path)}...")

    # Step 1: Overlay
    # For MVP, we write directly to output folder or a temp name in output folder?
    # overlay.process_image handles writing to the output folder.
    processed_path = overlay.process_image(
        file_path, 
        landscape_overlay, 
        portrait_overlay, 
        output_folder,
        file_prefix=config.get('file_prefix')
    )

    if processed_path:
        log_callback(f"Successfully processed: {processed_path}")
        # Step 2: Sync (if needed)
        # In our MVP Option 1, the file is already in the Drive-synced output folder.
        # But we call sync_file just in case we change strategy later or need to move it.
        uploader.sync_file(processed_path, output_folder)
        
        # Step 3: Index Faces
        try:
            from . import indexer
            index_path = os.path.join(output_folder, "index.json")
            event_indexer = indexer.EventIndexer(index_path)
            
            vectors = event_indexer.process_image(processed_path)
            if vectors:
                event_indexer.update_index(os.path.basename(processed_path), vectors)
                event_indexer.save()
                log_callback(f"Faces indexed for {os.path.basename(processed_path)}")
            else:
                log_callback(f"No faces found in {os.path.basename(processed_path)}")
                
        except Exception as e:
            log_callback(f"Indexing failed: {e}")
    else:
        log_callback("Failed to process image.")

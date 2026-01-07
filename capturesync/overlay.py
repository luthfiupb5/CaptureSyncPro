import os
from PIL import Image, ImageOps

def get_next_sequence_index(output_folder, prefix):
    """
    Scans output_folder for files starting with {prefix}_
    Returns the next available integer index.
    """
    max_index = 0
    try:
        if not os.path.exists(output_folder):
            return 1
            
        for filename in os.listdir(output_folder):
            if filename.startswith(prefix + "_") and filename.endswith(".jpg"):
                try:
                    # Extract number part: PREFIX_123.jpg -> 123
                    part = filename[len(prefix)+1:-4] 
                    index = int(part)
                    if index > max_index:
                        max_index = index
                except ValueError:
                    continue
    except Exception:
        pass
    
    return max_index + 1

def process_image(image_path, landscape_overlay_path, portrait_overlay_path, output_folder, file_prefix=None):
    """
    Reads image, detects orientation, applies appropriate overlay, and saves to output_folder.
    If file_prefix is provided, saves as {file_prefix}_{index}.jpg
    Returns the path to the saved file if successful, None otherwise.
    """
    try:
        # Open the image
        with Image.open(image_path) as img:
            # Fix EXIF orientation (crucial for looking right)
            img = ImageOps.exif_transpose(img)
            
            # Determine orientation
            width, height = img.size
            
            # Logic Update v5.0: Square treated as Landscape
            # Also relaxed requirements: one overlay might be None
            
            if width >= height: # Landscape or Square
                orientation = 'landscape'
                overlay_path = landscape_overlay_path
            else: # Portrait
                orientation = 'portrait'
                overlay_path = portrait_overlay_path
            
            # Fallback Logic: If specific overlay missing, try the other one?
            # User requirement: "atleast one overlay should be there"
            # If landscape needed but missing, try using portrait if user only provided that? 
            # (Though user said square can use landscape overlay. didn't explicitly say rotate portrait overlay).
            # Let's strictly check if the *assigned* overlay exists.
            
            if not overlay_path or not os.path.exists(overlay_path):
                # Try fallback if the other one exists?
                # "if someone doesnt be having any vertical dimention photos... the field for both overlay not be required"
                # This implies we just skip processing if we don't have the matching overlay?
                # Or do we error out?
                # "it just have a single face interface" -> implies maybe we just skip it silently or log warning.
                # However, for 100% solidity, let's return None so caller knows we couldn't process it.
                print(f"Skipping {image_path}: No overlay found for {orientation} orientation.") 
                return None
                
            with Image.open(overlay_path) as overlay:
                # Resize overlay to match image dimensions exactly
                # Using LANCZOS for high quality downscaling/upscaling
                overlay_resized = overlay.resize((width, height), Image.Resampling.LANCZOS)
                
                # Ensure we are working in RGBA to handle transparency correctly
                img = img.convert("RGBA")
                overlay_resized = overlay_resized.convert("RGBA")
                
                # Apply overlay
                img.alpha_composite(overlay_resized)
                
                # Prepare output path
                filename = os.path.basename(image_path)
                
                if file_prefix:
                    # Sequential naming strategy
                    next_index = get_next_sequence_index(output_folder, file_prefix)
                    output_filename = f"{file_prefix}_{next_index}.jpg"
                else:
                    # Original naming strategy
                    name, ext = os.path.splitext(filename)
                    output_filename = f"{name}_processed.jpg"

                output_path = os.path.join(output_folder, output_filename)
                
                # Convert back to RGB for JPEG saving
                final_img = img.convert("RGB")
                
                # Save
                final_img.save(output_path, quality=90, optimize=True)
                
                return output_path

    except Exception as e:
        print(f"Error processing {image_path}: {e}")
        return None

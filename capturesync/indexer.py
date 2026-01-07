import face_recognition
import json
import os
import numpy as np

class EventIndexer:
    def __init__(self, index_path):
        """
        Initialize the indexer with a path to the JSON index file.
        """
        self.index_path = index_path
        self.index_data = self._load_index()

    def _load_index(self):
        """
        Load existing index or create a new one.
        Structure:
        [
            {
                "image": "photo1.jpg",
                "vectors": [[0.1, 0.2, ...], [0.5, ...]]
            }
        ]
        """
        if os.path.exists(self.index_path):
            try:
                with open(self.index_path, 'r') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                return []
        return []

    def process_image(self, image_path):
        """
        Detects faces and returns 128d vectors for all faces found in the image.
        """
        try:
            # Load image
            image = face_recognition.load_image_file(image_path)
            
            # Detect face locations (using HOG for speed)
            face_locations = face_recognition.face_locations(image)
            
            # Compute encodings
            if not face_locations:
                return []
                
            face_encodings = face_recognition.face_encodings(image, face_locations)
            
            # Convert numpy arrays to lists for JSON serialization
            return [encoding.tolist() for encoding in face_encodings]
            
        except Exception as e:
            print(f"Error indexing {image_path}: {e}")
            return []

    def update_index(self, image_filename, vectors):
        """
        Adds or updates the entry for a specific image.
        """
        if not vectors:
            return

        # Check if entry exists, remove it if so (to allow re-indexing)
        self.index_data = [item for item in self.index_data if item['image'] != image_filename]
        
        # Add new entry
        entry = {
            "image": image_filename,
            "vectors": vectors
        }
        self.index_data.append(entry)

    def save(self):
        """
        Writes the current index to disk.
        """
        try:
            with open(self.index_path, 'w') as f:
                json.dump(self.index_data, f)
        except Exception as e:
            print(f"Error saving index: {e}")

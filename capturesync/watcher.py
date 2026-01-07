import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from . import processor

class ImageHandler(FileSystemEventHandler):
    def __init__(self, config, log_callback=None):
        self.config = config
        self.log_callback = log_callback

    def on_created(self, event):
        if not event.is_directory:
            processor.process_file(event.src_path, self.config, self.log_callback)

    def on_moved(self, event):
        # Handle case where file is moved INTO the folder
        if not event.is_directory:
             processor.process_file(event.dest_path, self.config, self.log_callback)

def start_watcher(source_folder, config, log_callback=None):
    """
    Non-blocking start for the GUI.
    Returns the observer object.
    """
    if not source_folder:
        if log_callback: log_callback("No source folder configured.")
        return None

    event_handler = ImageHandler(config, log_callback)
    observer = Observer()
    observer.schedule(event_handler, source_folder, recursive=False)
    observer.start()
    
    if log_callback:
        log_callback(f"Watching {source_folder} for new images...")
    
    return observer

def start_to_watch(config):
    """
    Blocking start for CLI usage.
    """
    source_folder = config.get("source_folder")
    if not source_folder:
        print("No source folder configured.")
        return

    # Use default print for CLI
    event_handler = ImageHandler(config, log_callback=print)
    observer = Observer()
    observer.schedule(event_handler, source_folder, recursive=False)
    observer.start()
    
    print(f"Watching {source_folder} for new images...")
    print("Press Ctrl+C to stop.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    
    observer.join()

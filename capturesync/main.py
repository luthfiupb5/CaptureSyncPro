import sys
import os

# Ensure we can import sibling modules if running as script from inside folder
# (This adds the parent directory of 'capturesync' to sys.path)
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

from capturesync.gui import CaptureSyncApp

def main():
    app = CaptureSyncApp()
    app.mainloop()

if __name__ == "__main__":
    main()

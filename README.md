# CaptureSync Pro

**Automated Image Overlay & Cloud Sync Tool (Windows GUI Edition)**

CaptureSync is a professional automation tool designed for photographers and event organizers. It acts as a real-time bridge between your camera (or Lightroom export folder) and Google Drive, immediately applying branding overlays and syncing files for instant sharing.

**v5.0 brings a complete graphical user interface (GUI), no terminal required!**

![CaptureSync GUI](https://via.placeholder.com/800x400?text=CaptureSync+v5.0+GUI) 
*(Screenshot placeholder)*

## ✨ What's New in v5.0?

- **🖥️ Full GUI Interface**: A modern, dark-themed (CustomTkinter) app. No more black command-line windows.
- **🖼️ Flex-Overlay Logic**: 
    - You only need *one* overlay (Landscape OR Portrait).
    - **Square Support**: 1:1 images are automatically handled using the Landscape overlay.
- **👁️ Live Gallery**: Watch processed images appear in real-time in the new "Gallery" tab.
- **📂 Process Existing Files**: One-click option to process photos already sitting in your folder.
- **📊 Live Progress**: Real-time progress bar and "Processed / Total" counter.
- **🛑 Instant Stop**: Stop button now halts processing immediately.

## 🚀 Key Features

- **Real-time Watcher**: Detects new images the moment they hit the folder.
- **Smart Orientation**: Automatically applies the correct overlay (Landscape vs Portrait).
- **Auto-Naming**: Options to keep original filenames or use a custom prefix sequence (e.g., `EventName_1.jpg`).
- **Instant Cloud Sync**: Saves directly to your Google Drive Desktop folder for immediate upload.

## 🛠️ Usage (The Easy Way)

**No Python? No Problem.** CaptureSync is now a standalone Windows Application.

1.  **Download**: Get `CaptureSync.exe` from the [Releases](https://github.com/luthfiupb5/CaptureSync/releases) page.
2.  **Run**: Double-click the file. (No installation needed!)
3.  **Configure**:
    *   **Source Folder**: Browse to your Camera/Lightroom export folder.
    *   **Overlays**: Browse to your transparent PNG frames.
    *   **Output Folder**: Browse to your Google Drive folder.
4.  **Start**: Click **Start Automation**.

That's it! As you take photos, they will automatically be processed and appear in your Gallery tab and your Drive folder.

## ⚙️ Requirements

- **Operating System**: Windows 10 or 11.
- **Cloud Sync**: Google Drive for Desktop (or Dropbox/OneDrive) recommended for the sync feature.

## 👨‍💻 For Developers

If you want to run from source:

1.  **Clone**:
    ```bash
    git clone https://github.com/luthfiupb5/CaptureSync.git
    cd CaptureSync
    ```
2.  **Install**:
    ```bash
    pip install -r requirements.txt
    ```
3.  **Run**:
    ```bash
    python -m capturesync.main
    ```

## 👤 Credits

**Developed By Luthfi Bassam U P**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/luthfibassamup/)

---
*Built with ❤️ Luthfi Bassam U P*

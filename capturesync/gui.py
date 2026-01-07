import os
import sys
import json
import threading
import webbrowser
import customtkinter as ctk
from PIL import Image, ImageDraw, ImageOps

try:
    from . import processor, watcher
except ImportError:
    import processor
    import watcher

# Theme Settings
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

CONFIG_FILE = "gui_config.json"
VERSION = "5.0"

# Minimalist Pro Palette
THEME = {
    "bg": "#121212",           # Main Background
    "sidebar": "#1a1a1a",      # Sidebar Background
    "card_bg": "#242424",      # Card Surface
    "card_hover": "#2f2f2f",   # Hover state
    "accent": "#3b8ed0",       # Primary Blue
    "text_primary": "#ffffff",
    "text_secondary": "#a0a0a0",
    "border": "#383838"
}

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

class CaptureSyncApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title(f"CaptureSync v{VERSION}")
        self.geometry("1400x850")

        # Configuration Data
        self.source_var = ctk.StringVar()
        self.landscape_var = ctk.StringVar()
        self.portrait_var = ctk.StringVar()
        self.output_var = ctk.StringVar()
        self.prefix_var = ctk.StringVar(value="fujifilm_x100v_")
        
        self.process_existing_var = ctk.BooleanVar(value=False)
        
        # Runtime State
        self.observer = None
        self.running = False
        self.total_files = 0
        self.processed_count = 0
        self.gallery_images = [] 

        self.load_config()
        self.create_layout()
        
        # Start at Dashboard
        self.select_frame("dashboard")
        
    def create_layout(self):
        # 2 Column Layout (Sidebar | Content)
        self.grid_columnconfigure(0, weight=0, minsize=220) # Sidebar
        self.grid_columnconfigure(1, weight=1)              # Content
        self.grid_rowconfigure(0, weight=1)

        # === COL 0: SIDEBAR ===
        self.sidebar = ctk.CTkFrame(self, corner_radius=0, fg_color=THEME["sidebar"], border_width=0)
        self.sidebar.grid(row=0, column=0, sticky="nsew")
        
        # === COL 1: CONTENT CONTAINER ===
        self.content_container = ctk.CTkFrame(self, corner_radius=0, fg_color=THEME["bg"])
        self.content_container.grid(row=0, column=1, sticky="nsew")
        self.content_container.grid_columnconfigure(0, weight=1)
        self.content_container.grid_rowconfigure(0, weight=1)

        # Create the separate views
        self.create_sidebar_content()
        self.create_dashboard_view()
        self.create_gallery_view()

    def create_sidebar_content(self):
        # Brand
        brand_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        brand_frame.pack(pady=(40, 20), padx=25, fill="x")
        
        ctk.CTkLabel(brand_frame, text="CaptureSync", font=ctk.CTkFont(size=24, weight="bold"), text_color="white", anchor="w").pack(fill="x")
        ctk.CTkLabel(brand_frame, text="Pro Automation", font=ctk.CTkFont(size=12), text_color=THEME["text_secondary"], anchor="w").pack(fill="x")
        
        # Separator
        ctk.CTkFrame(self.sidebar, height=2, fg_color=THEME["card_bg"]).pack(fill="x", padx=25, pady=(0, 20))

        # Nav Buttons
        self.btn_dashboard = self.create_nav_button("Dashboard", "dashboard")
        self.btn_gallery = self.create_nav_button("Gallery", "gallery")
        
        # Spacer
        ctk.CTkFrame(self.sidebar, fg_color="transparent").pack(fill="both", expand=True)

        # Meet the Developer Section
        self.create_developer_card()
        
        # Simple Version Footer
        footer_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        footer_frame.pack(side="bottom", fill="x", padx=25, pady=(0, 20))
        ctk.CTkLabel(footer_frame, text=f"v{VERSION}", text_color=THEME["text_secondary"], font=ctk.CTkFont(size=10), anchor="w").pack(fill="x")

    def create_developer_card(self):
        dev_frame = ctk.CTkFrame(self.sidebar, fg_color=THEME["card_bg"], corner_radius=10)
        dev_frame.pack(side="bottom", fill="x", padx=15, pady=15)
        
        # Header
        ctk.CTkLabel(dev_frame, text="Meet the Developer", text_color=THEME["text_primary"], font=ctk.CTkFont(size=12, weight="bold")).pack(pady=(10, 5))
        
        # Profile Image (Circular crop)
        try:
            # Use resource_path helper to find the bundled asset
            img_path = resource_path(os.path.join("assets", "Founder_dp.jpg"))
            
            if os.path.exists(img_path):
                img = Image.open(img_path)
                
                # Create circular mask
                mask = Image.new('L', img.size, 0)
                draw = ImageDraw.Draw(mask) 
                draw.ellipse((0, 0) + img.size, fill=255)
                
                market_img = ImageOps.fit(img, mask.size, centering=(0.5, 0.5))
                market_img.putalpha(mask)
                
                market_img = market_img.resize((60, 60), Image.Resampling.LANCZOS)
                
                photo = ctk.CTkImage(light_image=market_img, dark_image=market_img, size=(60, 60))
                ctk.CTkLabel(dev_frame, image=photo, text="").pack(pady=5)
            else:
                print(f"Profile image not found at: {img_path}")
        except Exception as e:
            print(f"Error loading profile image: {e}")
        
        # Name
        ctk.CTkLabel(dev_frame, text="Luthfi Bassam U P", text_color="white", font=ctk.CTkFont(size=13, weight="bold")).pack()
        
        # Contact Info
        ctk.CTkLabel(dev_frame, text="connect.luthfi05@gmail.com", text_color=THEME["text_secondary"], font=ctk.CTkFont(size=10)).pack()
        ctk.CTkLabel(dev_frame, text="+91 7356556087", text_color=THEME["text_secondary"], font=ctk.CTkFont(size=10)).pack()
        
        # LinkedIn Button
        link_btn = ctk.CTkButton(
            dev_frame, 
            text="Connect on LinkedIn", 
            font=ctk.CTkFont(size=11),
            height=28,
            fg_color="#0077b5", # LinkedIn Blue
            hover_color="#005582",
            command=lambda: webbrowser.open("https://www.linkedin.com/in/luthfibassamup/")
        )
        link_btn.pack(pady=10, padx=10, fill="x")


    def create_nav_button(self, text, view_name):
        btn = ctk.CTkButton(
            self.sidebar, 
            text=text, 
            fg_color="transparent", 
            hover_color=THEME["card_hover"], 
            anchor="w",
            height=45,
            corner_radius=8,
            font=ctk.CTkFont(size=14, weight="normal"),
            text_color=THEME["text_primary"],
            command=lambda: self.select_frame(view_name)
        )
        btn.pack(fill="x", padx=15, pady=5)
        return btn

    def create_dashboard_view(self):
        self.dashboard_frame = ctk.CTkFrame(self.content_container, fg_color="transparent")
        self.dashboard_frame.grid_columnconfigure(0, weight=3) # Main
        self.dashboard_frame.grid_columnconfigure(1, weight=1) # Widgets
        self.dashboard_frame.grid_rowconfigure(0, weight=1)

        # -- Left: Config --
        left_panel = ctk.CTkFrame(self.dashboard_frame, fg_color="transparent")
        left_panel.grid(row=0, column=0, sticky="nsew", padx=40, pady=40)
        
        ctk.CTkLabel(left_panel, text="Configuration", font=ctk.CTkFont(size=26, weight="bold"), text_color="white", anchor="w").pack(fill="x", pady=(0, 20))

        self.create_config_card(left_panel, "Source Directory", "Incoming folder", self.source_var, lambda: self.browse_folder(self.source_var))
        self.create_config_card(left_panel, "Cloud Output", "Destination folder", self.output_var, lambda: self.browse_folder(self.output_var))
        self.create_config_card(left_panel, "Overlays", "Branding assets", None, None, is_overlay_group=True)
        self.create_config_card(left_panel, "Filename Prefix", "Optional prefix for output files", self.prefix_var, None)
        
        # Action Zone
        action_frame = ctk.CTkFrame(left_panel, fg_color="transparent")
        action_frame.pack(fill="both", expand=True, pady=30)
        
        self.status_label = ctk.CTkLabel(action_frame, text="Ready.", font=ctk.CTkFont(size=14), text_color="gray")
        self.status_label.pack(side="bottom", pady=(10, 0))

        btn_row = ctk.CTkFrame(action_frame, fg_color="transparent")
        btn_row.place(relx=0.5, rely=0.5, anchor="center")
        
        self.start_btn = ctk.CTkButton(btn_row, text="START", font=ctk.CTkFont(size=15, weight="bold"), height=50, width=140, fg_color=THEME["accent"], corner_radius=25, command=self.start_process)
        self.start_btn.pack(side="left", padx=10)

        self.pause_btn = ctk.CTkButton(btn_row, text="PAUSE", font=ctk.CTkFont(size=15, weight="bold"), height=50, width=140, fg_color="transparent", border_width=2, border_color="gray", text_color="gray", corner_radius=25, state="disabled", command=self.toggle_pause)
        self.pause_btn.pack(side="left", padx=10)
        
        self.stop_btn = ctk.CTkButton(btn_row, text="STOP", font=ctk.CTkFont(size=15, weight="bold"), height=50, width=100, fg_color="transparent", border_width=2, border_color="#c0392b", text_color="#c0392b", corner_radius=25, state="disabled", command=self.stop_process)
        self.stop_btn.pack(side="left", padx=10)
        
        self.existing_cb = ctk.CTkCheckBox(action_frame, text="Process Existing Files", variable=self.process_existing_var, font=ctk.CTkFont(size=12), text_color="gray", hover_color=THEME["accent"])
        self.existing_cb.place(relx=0.5, rely=0.8, anchor="center")

        # -- Right: Widgets --
        right_panel = ctk.CTkFrame(self.dashboard_frame, fg_color="transparent")
        right_panel.grid(row=0, column=1, sticky="nsew", padx=(0, 40), pady=40)
        
        # Stats
        stats_card = ctk.CTkFrame(right_panel, fg_color=THEME["card_bg"], corner_radius=12)
        stats_card.pack(fill="x", pady=(0, 20))
        ctk.CTkLabel(stats_card, text="Session Stats", font=ctk.CTkFont(size=14, weight="bold"), text_color="white", anchor="w").pack(padx=20, pady=15, fill="x")
        self.processed_label = ctk.CTkLabel(stats_card, text="0", font=ctk.CTkFont(size=48, weight="bold"), text_color=THEME["accent"])
        self.processed_label.pack(anchor="w", padx=20)
        self.total_label = ctk.CTkLabel(stats_card, text="/ 0 Files", font=ctk.CTkFont(size=14), text_color="gray")
        self.total_label.pack(anchor="w", padx=22, pady=(0, 20))
        self.progress_bar = ctk.CTkProgressBar(stats_card, progress_color=THEME["accent"], fg_color=THEME["bg"], height=8)
        self.progress_bar.pack(fill="x", padx=20, pady=(0, 25))
        self.progress_bar.set(0)

        # Recent Log (Mini Gallery removed from here to reduce clutter, moved to Log)
        ctk.CTkLabel(right_panel, text="Recent Activity", font=ctk.CTkFont(size=14, weight="bold"), text_color="white", anchor="w").pack(fill="x", pady=(10, 10))
        self.log_box = ctk.CTkTextbox(right_panel, state="disabled", fg_color=THEME["card_bg"], text_color=THEME["text_secondary"])
        self.log_box.pack(fill="both", expand=True)

    def create_gallery_view(self):
        self.gallery_frame = ctk.CTkFrame(self.content_container, fg_color="transparent")
        # Don't grid it yet.
        
        ctk.CTkLabel(self.gallery_frame, text="Gallery", font=ctk.CTkFont(size=26, weight="bold"), text_color="white", anchor="w").pack(fill="x", padx=40, pady=(40, 20))
        
        self.gallery_scroll = ctk.CTkScrollableFrame(self.gallery_frame, fg_color="transparent")
        self.gallery_scroll.pack(fill="both", expand=True, padx=40, pady=(0, 40))
        
        self.gallery_row = 0
        self.gallery_col = 0
        self.MAX_GALLERY_COLS = 3

    def create_config_card(self, parent, title, subtitle, var, cmd, is_overlay_group=False):
        card = ctk.CTkFrame(parent, fg_color=THEME["card_bg"], corner_radius=10, height=80)
        card.pack(fill="x", pady=8)
        inner = ctk.CTkFrame(card, fg_color="transparent")
        inner.pack(fill="both", expand=True, padx=20, pady=15)
        
        labels = ctk.CTkFrame(inner, fg_color="transparent")
        labels.pack(side="left", fill="y")
        ctk.CTkLabel(labels, text=title, font=ctk.CTkFont(size=14, weight="bold"), text_color="white", anchor="w").pack(fill="x")
        ctk.CTkLabel(labels, text=subtitle, font=ctk.CTkFont(size=11), text_color="gray", anchor="w").pack(fill="x")

        controls = ctk.CTkFrame(inner, fg_color="transparent")
        controls.pack(side="right")
        
        if not is_overlay_group:
            entry = ctk.CTkEntry(controls, textvariable=var, width=220, fg_color=THEME["bg"], border_width=1, border_color=THEME["border"], text_color="white")
            entry.pack(side="left", padx=(0, 10))
            if cmd:
                ctk.CTkButton(controls, text="Browse", width=70, fg_color=THEME["sidebar"], hover_color=THEME["card_hover"], text_color=THEME["text_primary"], command=cmd).pack(side="left")
        else:
            ctk.CTkButton(controls, text="Landscape", width=110, fg_color=THEME["sidebar"], hover_color=THEME["card_hover"], command=lambda: self.browse_file(self.landscape_var)).pack(side="left", padx=5)
            ctk.CTkButton(controls, text="Portrait", width=110, fg_color=THEME["sidebar"], hover_color=THEME["card_hover"], command=lambda: self.browse_file(self.portrait_var)).pack(side="left", padx=5)

    def select_frame(self, name):
        # Reset buttons
        self.btn_dashboard.configure(fg_color="transparent", text_color=THEME["text_primary"])
        self.btn_gallery.configure(fg_color="transparent", text_color=THEME["text_primary"])

        # Highlight current
        if name == "dashboard":
            self.btn_dashboard.configure(fg_color=THEME["card_bg"], text_color=THEME["accent"])
            self.gallery_frame.grid_forget()
            self.dashboard_frame.grid(row=0, column=0, sticky="nsew")
        elif name == "gallery":
            self.btn_gallery.configure(fg_color=THEME["card_bg"], text_color=THEME["accent"])
            self.dashboard_frame.grid_forget()
            self.gallery_frame.grid(row=0, column=0, sticky="nsew")

    # --- LOGIC ---
    def browse_folder(self, var):
        d = ctk.filedialog.askdirectory()
        if d: var.set(d); self.save_config()

    def browse_file(self, var):
        f = ctk.filedialog.askopenfilename(filetypes=[("Images", "*.png;*.jpg;*.jpeg")])
        if f: var.set(f); self.save_config()

    def load_config(self):
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, 'r') as f:
                    data = json.load(f)
                    self.source_var.set(data.get("source_folder", ""))
                    self.output_var.set(data.get("output_folder", ""))
                    self.landscape_var.set(data.get("landscape_overlay", ""))
                    self.portrait_var.set(data.get("portrait_overlay", ""))
                    self.prefix_var.set(data.get("file_prefix", "fujifilm_x100v_"))
            except Exception: pass

    def save_config(self):
        data = {
            "source_folder": self.source_var.get(),
            "output_folder": self.output_var.get(),
            "landscape_overlay": self.landscape_var.get(),
            "portrait_overlay": self.portrait_var.get(),
            "file_prefix": self.prefix_var.get()
        }
        with open(CONFIG_FILE, 'w') as f: json.dump(data, f)
            
    def log(self, message):
        self.status_label.configure(text=message[:50] + "..." if len(message)>50 else message)
        self.log_box.configure(state="normal")
        self.log_box.insert("0.0", message + "\n") # Insert at top
        self.log_box.configure(state="disabled")

        if message.startswith("Detected new file:"):
             self.total_files += 1
             self.update_progress_ui()

        if message.startswith("Successfully processed: "):
            path = message.replace("Successfully processed: ", "").strip()
            self.processed_count += 1
            self.update_progress_ui()
            self.add_to_gallery(path)

    def update_progress_ui(self):
        self.processed_label.configure(text=str(self.processed_count))
        self.total_label.configure(text=f"/ {self.total_files} Files")
        if self.total_files > 0:
            val = self.processed_count / self.total_files
            self.progress_bar.set(min(1.0, val))
        else:
            self.progress_bar.set(0)

    def add_to_gallery(self, image_path):
        if not os.path.exists(image_path): return
        try:
            img = Image.open(image_path)
            img.thumbnail((250, 250)) 
            ctk_img = ctk.CTkImage(light_image=img, dark_image=img, size=img.size)
            lbl = ctk.CTkLabel(self.gallery_scroll, image=ctk_img, text="")
            lbl.grid(row=self.gallery_row, column=self.gallery_col, padx=10, pady=10)
            self.gallery_images.append(ctk_img)
            self.gallery_col += 1
            if self.gallery_col >= self.MAX_GALLERY_COLS:
                self.gallery_col = 0
                self.gallery_row += 1
        except Exception as e: print(f"Gallery error: {e}")

    def count_initial_files(self, folder):
        try:
            exts = {".jpg", ".jpeg", ".png"}
            count = 0
            for f in os.listdir(folder):
                if os.path.splitext(f)[1].lower() in exts:
                    if "_processed" not in f: count += 1
            return count
        except Exception: return 0

    def start_process(self):
        if not self.source_var.get() or not self.output_var.get(): return
        self.running = True
        self.is_paused = False
        self.start_btn.configure(state="disabled", text="RUNNING")
        self.pause_btn.configure(state="normal", text="PAUSE", border_color="white", text_color="white")
        self.stop_btn.configure(state="normal")
        self.existing_cb.configure(state="disabled")
        
        self.processed_count = 0
        src = self.source_var.get()
        self.total_files = self.count_initial_files(src) if self.process_existing_var.get() else 0
        self.update_progress_ui()
        self.log_box.configure(state="normal"); self.log_box.delete("0.0", "end"); self.log_box.configure(state="disabled")

        config = {
            "source_folder": self.source_var.get(),
            "landscape_overlay": self.landscape_var.get(),
            "portrait_overlay": self.portrait_var.get(),
            "output_folder": self.output_var.get(),
            "file_prefix": self.prefix_var.get()
        }
        
        self.active_config = config # Save for Resume
        self.log_cb = lambda msg: self.after(0, self.log, msg)

        if self.process_existing_var.get():
            threading.Thread(target=self.process_existing_files, args=(config, self.log_cb)).start()

        self.observer = watcher.start_watcher(self.source_var.get(), config, log_callback=self.log_cb)

    def toggle_pause(self):
        if not self.is_paused:
            # PAUSE
            self.is_paused = True
            if self.observer:
                self.observer.stop()
                self.observer = None
            self.pause_btn.configure(text="RESUME", border_color="yellow", text_color="yellow")
            self.status_label.configure(text="Paused.")
        else:
            # RESUME
            self.is_paused = False
            self.pause_btn.configure(text="PAUSE", border_color="white", text_color="white")
            self.status_label.configure(text="Resumed.")
            # Restart watcher with same config
            if self.active_config:
                self.observer = watcher.start_watcher(self.source_var.get(), self.active_config, log_callback=self.log_cb)

    def process_existing_files(self, config, log_callback):
        source = config['source_folder']
        try:
            files = sorted(os.listdir(source))
            for filename in files:
                 if not self.running: break
                 while self.is_paused:
                     if not self.running: break
                     self.update() # Keep UI alive but sleep logic
                     threading.Event().wait(0.5)

                 filepath = os.path.join(source, filename)
                 if os.path.isfile(filepath): processor.process_file(filepath, config, log_callback)
        except Exception as e: pass

    def stop_process(self):
        self.running = False
        self.is_paused = False
        if self.observer: self.observer.stop()
        
        self.start_btn.configure(state="normal", text="START PROCESS")
        self.pause_btn.configure(state="disabled", text="PAUSE", border_color="gray", text_color="gray")
        self.stop_btn.configure(state="disabled")
        self.existing_cb.configure(state="normal")
        self.status_label.configure(text="Stopped.")

if __name__ == "__main__":
    app = CaptureSyncApp()
    app.mainloop()

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as faceapi from 'face-api.js';
import { FaceMatcher } from "@/lib/matcher";
import { Upload, Plus, ExternalLink, Loader2, Image as ImageIcon, Copy, FolderInput, Layers, Trash2, Eye, LogOut, ImagePlus, Database, Activity, Server } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

interface Event {
    id: string;
    name: string;
    banner?: string;
}

interface Photo {
    id: string;
    url: string;
}

interface AuthUser {
    id: string;
    role: 'super_admin' | 'program_admin';
    eventId: string | null;
}

export default function AdminDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

    // UI States
    const [loading, setLoading] = useState(true);
    const [modelStatus, setModelStatus] = useState("Loading AI...");
    const [isCreating, setIsCreating] = useState(false);
    const [newEventName, setNewEventName] = useState("");
    const [newEventBanner, setNewEventBanner] = useState("");

    // Processing States
    const [landscapeOverlay, setLandscapeOverlay] = useState<HTMLImageElement | null>(null);
    const [portraitOverlay, setPortraitOverlay] = useState<HTMLImageElement | null>(null);
    const [processingStatus, setProcessingStatus] = useState("");

    // Upload States
    const [uploadQueue, setUploadQueue] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

    // Gallery State
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            if (!data.user) {
                router.push('/admin/login');
                return;
            }
            setUser(data.user);
            fetchEvents(data.user);
            FaceMatcher.getInstance().loadModels().then(() => setModelStatus("AI Ready"));
        } catch (e) {
            router.push('/admin/login');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/admin/login');
    };

    useEffect(() => {
        if (selectedEvent) {
            fetchPhotos(selectedEvent.id);
        } else {
            setPhotos([]);
        }
    }, [selectedEvent]);

    const fetchEvents = async (currentUser: AuthUser) => {
        try {
            const res = await fetch('/api/events');
            let data: Event[] = await res.json();

            if (!Array.isArray(data)) {
                data = [];
            }

            // RBAC Filtering
            if (currentUser.role === 'program_admin' && currentUser.eventId) {
                data = data.filter(e => e.id === currentUser.eventId);
                if (data.length > 0) setSelectedEvent(data[0]);
            }

            setEvents(data);
        } catch (e) {
            console.error("Failed to load events", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchPhotos = async (eventId: string) => {
        setLoadingPhotos(true);
        try {
            const res = await fetch(`/api/events/${eventId}/photos`);
            const data = await res.json();
            setPhotos(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingPhotos(false);
        }
    };

    const createEvent = async () => {
        if (!newEventName) return;
        try {
            const res = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newEventName, banner: newEventBanner })
            });
            const event = await res.json();
            setEvents([...events, event]);
            setIsCreating(false);
            setNewEventName("");
            setSelectedEvent(event);
        } catch (e) {
            alert("Error creating event");
        }
    };

    const deleteEvent = async () => {
        if (!selectedEvent) return;
        if (!confirm(`Are you sure you want to delete "${selectedEvent.name}"? This cannot be undone.`)) return;

        try {
            await fetch(`/api/events/${selectedEvent.id}`, { method: 'DELETE' });
            const newEvents = events.filter(e => e.id !== selectedEvent.id);
            setEvents(newEvents);
            setSelectedEvent(null);
        } catch (e) {
            alert("Failed to delete event");
        }
    };

    // --- Overlay Handling ---
    const handleOverlaySelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'landscape' | 'portrait') => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    if (type === 'landscape') setLandscapeOverlay(img);
                    else setPortraitOverlay(img);
                };
                img.src = ev.target?.result as string;
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    // --- Image Processing ---
    const processImage = async (file: File): Promise<{ blob: Blob, vectors: number[][] } | null> => {
        return new Promise(async (resolve) => {
            try {
                // 1. Load Raw Image for Face Detection
                const imgUrl = URL.createObjectURL(file);
                const img = await faceapi.fetchImage(imgUrl);

                // 2. Detect Faces on Raw Image (Best Accuracy)
                const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
                const vectors = detections.map(d => Array.from(d.descriptor));

                // 3. Apply Overlay if exists
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error("Canvas context failed");

                // Draw Original
                ctx.drawImage(img, 0, 0);

                // Draw Overlay
                const isLandscape = img.width > img.height;
                const overlay = isLandscape ? landscapeOverlay : portraitOverlay;

                if (overlay) {
                    // Resize overlay to fit
                    ctx.drawImage(overlay, 0, 0, img.width, img.height);
                }

                // 4. Export result
                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(imgUrl);
                    if (blob) resolve({ blob, vectors });
                    else resolve(null);
                }, 'image/jpeg', 0.95);

            } catch (e) {
                console.error("Processing failed", e);
                resolve(null);
            }
        });
    };

    const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
            if (files.length > 0) {
                setUploadQueue(files);
                startBatchProcessing(files);
            }
        }
    };

    const startBatchProcessing = async (files: File[]) => {
        if (!selectedEvent) return;
        setUploading(true);
        setUploadProgress({ current: 0, total: files.length });

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setProcessingStatus(`Processing ${file.name}...`);

            try {
                const result = await processImage(file);

                if (result) {
                    const formData = new FormData();
                    formData.append('file', result.blob, file.name);
                    formData.append('eventId', selectedEvent.id);
                    formData.append('vectors', JSON.stringify(result.vectors));

                    await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });
                }
            } catch (e) {
                console.error(`Error processing/uploading ${file.name}`, e);
            }
            setUploadProgress(prev => ({ ...prev, current: i + 1 }));
        }

        setUploading(false);
        setUploadQueue([]);
        setProcessingStatus("");
        fetchPhotos(selectedEvent.id);
        alert("Batch Processing Complete!");
    };

    const getEventLink = (event: Event) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return `${origin}/?eventId=${event.id}`;
    };

    const downloadQr = () => {
        const canvas = document.getElementById('high-res-qr') as HTMLCanvasElement;
        if (canvas) {
            const pngUrl = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `event-qr-${selectedEvent?.id}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    };

    if (authLoading) return <div className="h-screen bg-[#02020A] flex items-center justify-center text-white"><Loader2 className="animate-spin text-[var(--primary)] w-12 h-12" /></div>;

    return (
        <main className="h-screen bg-[#02020A] text-white font-sans flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-72 glass-panel border-r border-[#ffffff10] flex flex-col z-20 flex-shrink-0">
                <div className="p-8">
                    <h1 className="text-2xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]">
                        CaptureSync
                    </h1>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 mt-1">Admin Console</p>
                </div>

                <div className="flex-1 overflow-y-auto px-4 space-y-2">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Active Events</h2>
                    {loading ? <div className="flex justify-center p-4"><Loader2 className="animate-spin text-gray-500" /></div> : (
                        events.map(ev => (
                            <button
                                key={ev.id}
                                onClick={() => setSelectedEvent(ev)}
                                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 border ${selectedEvent?.id === ev.id ? 'bg-[var(--primary)]/10 border-[var(--primary)]/50 text-white shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-white'}`}
                            >
                                <span className="font-medium">{ev.name}</span>
                            </button>
                        ))
                    )}
                </div>

                {user?.role === 'super_admin' && (
                    <div className="p-4">
                        <button
                            onClick={() => setIsCreating(true)}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white p-3 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(112,0,255,0.4)] font-bold active:scale-95"
                        >
                            <Plus size={18} /> New Event
                        </button>
                    </div>
                )}

                <div className="p-6 border-t border-[#ffffff10] bg-black/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center font-bold shadow-lg">
                            {user?.role === 'super_admin' ? 'A' : 'P'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate text-white">Administrator</p>
                            <p className="text-[10px] text-[var(--primary)] truncate uppercase tracking-wider">{user?.role.replace('_', ' ')}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 text-red-400 hover:text-white hover:bg-red-500/10 px-4 py-2 rounded-lg transition-colors text-xs font-bold uppercase tracking-wide"
                    >
                        <LogOut size={14} /> Terminate Session
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-[#02020A] to-[#02020A] overflow-y-auto relative">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5 pointer-events-none fixed"></div>

                <div className="p-10 relative z-10">
                    {selectedEvent ? (
                        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
                            {/* Header */}
                            <header className="flex justify-between items-end glass-panel p-8 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent">
                                <div>
                                    <h2 className="text-5xl font-display font-bold mb-2 text-white">{selectedEvent.name}</h2>
                                    <div className="flex items-center gap-3 text-gray-400 font-mono text-xs">
                                        <span className="px-2 py-1 rounded bg-white/5 text-[var(--primary)] border border-white/10">ID: {selectedEvent.id}</span>
                                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Live</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-3">
                                    <div className="flex gap-2">
                                        {user?.role === 'super_admin' && (
                                            <button
                                                onClick={deleteEvent}
                                                className="p-3 rounded-full hover:bg-red-500/20 text-red-400 hover:text-red-500 transition-colors"
                                                title="Delete Event"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => navigator.clipboard.writeText(getEventLink(selectedEvent))}
                                            className="p-3 rounded-full hover:bg-white/10 text-white transition-colors"
                                            title="Copy Link"
                                        >
                                            <Copy size={20} />
                                        </button>
                                        <a
                                            href={getEventLink(selectedEvent)}
                                            target="_blank"
                                            className="p-3 rounded-full bg-white text-black hover:bg-[var(--primary)] transition-colors"
                                            title="Open Client View"
                                        >
                                            <ExternalLink size={20} />
                                        </a>
                                    </div>
                                </div>
                            </header>

                            {/* Stats Dashboard */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 border-b-2 border-b-[var(--primary)]">
                                    <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)]">
                                        <ImageIcon size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-mono uppercase">Total Assets</p>
                                        <p className="text-2xl font-bold font-display">{photos.length}</p>
                                    </div>
                                </div>
                                <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 border-b-2 border-b-[var(--secondary)]">
                                    <div className="w-12 h-12 rounded-xl bg-[var(--secondary)]/20 flex items-center justify-center text-[var(--secondary)]">
                                        <Database size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-mono uppercase">Storage Est</p>
                                        <p className="text-2xl font-bold font-display">{(photos.length * 2.5).toFixed(1)} <span className="text-sm">MB</span></p>
                                    </div>
                                </div>
                                <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 border-b-2 border-b-green-500">
                                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-green-500">
                                        <Activity size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-mono uppercase">Engagement</p>
                                        <p className="text-2xl font-bold font-display">Active</p>
                                    </div>
                                </div>
                                <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 border-b-2 border-b-pink-500">
                                    <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-500">
                                        <Server size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-mono uppercase">System Node</p>
                                        <p className="text-2xl font-bold font-display">{modelStatus === "AI Ready" ? "Online" : "Booting"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-8">
                                {/* LEFT COL: Config & Upload */}
                                <div className="col-span-12 lg:col-span-4 space-y-6">
                                    {/* 1. Configuration Section */}
                                    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-50"><Layers size={40} className="text-blue-500" /></div>
                                        <h3 className="text-xl font-display font-bold mb-6 relative z-10">Overlay Config</h3>

                                        <div className="space-y-4 relative z-10">
                                            <div className="p-4 rounded-xl bg-black/40 border border-white/5 hover:border-blue-500/50 transition-colors">
                                                <label className="block text-xs text-blue-400 font-bold uppercase mb-2">Landscape Frame</label>
                                                <div className="flex items-center gap-3">
                                                    <input type="file" accept="image/png" onChange={(e) => handleOverlaySelect(e, 'landscape')} className="text-xs text-gray-500 w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20" />
                                                    {landscapeOverlay && <div className="text-green-400 bg-green-400/10 p-1 rounded-full"><Eye size={14} /></div>}
                                                </div>
                                            </div>
                                            <div className="p-4 rounded-xl bg-black/40 border border-white/5 hover:border-purple-500/50 transition-colors">
                                                <label className="block text-xs text-purple-400 font-bold uppercase mb-2">Portrait Frame</label>
                                                <div className="flex items-center gap-3">
                                                    <input type="file" accept="image/png" onChange={(e) => handleOverlaySelect(e, 'portrait')} className="text-xs text-gray-500 w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-500/10 file:text-purple-400 hover:file:bg-purple-500/20" />
                                                    {portraitOverlay && <div className="text-green-400 bg-green-400/10 p-1 rounded-full"><Eye size={14} /></div>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Upload Section */}
                                    <div className="glass-panel rounded-2xl p-6 border-t-4 border-t-[var(--secondary)]">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-xl font-display font-bold">Upload Center</h3>
                                            <Upload size={20} className="text-[var(--secondary)]" />
                                        </div>

                                        {!uploading ? (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    {/* Single/Multiple Files */}
                                                    <div className="relative group cursor-pointer">
                                                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--secondary)] to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                                                        <div className="relative bg-black/60 border border-white/10 rounded-2xl p-6 text-center hover:bg-white/5 transition-all h-full flex flex-col items-center justify-center gap-3">
                                                            <input type="file" multiple accept="image/*" onChange={handleFolderSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                                                            <ImagePlus className="text-gray-400 group-hover:text-white transition-colors" size={32} />
                                                            <p className="font-bold text-sm">Select Files</p>
                                                        </div>
                                                    </div>

                                                    {/* Folder Upload */}
                                                    <div className="relative group cursor-pointer">
                                                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)] to-green-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                                                        <div className="relative bg-black/60 border border-white/10 rounded-2xl p-6 text-center hover:bg-white/5 transition-all h-full flex flex-col items-center justify-center gap-3">
                                                            {/* @ts-ignore: webkitdirectory */}
                                                            <input type="file" multiple webkitdirectory="" onChange={handleFolderSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                                                            <FolderInput className="text-gray-400 group-hover:text-white transition-colors" size={32} />
                                                            <p className="font-bold text-sm">Select Folder</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-center text-gray-500 font-mono uppercase tracking-widest">Supports Drag & Drop</p>
                                            </div>
                                        ) : (
                                            <div className="py-8 text-center space-y-6">
                                                <div className="relative w-20 h-20 mx-auto">
                                                    <div className="absolute inset-0 border-4 border-[var(--secondary)]/30 rounded-full"></div>
                                                    <div className="absolute inset-0 border-4 border-t-[var(--secondary)] rounded-full animate-spin"></div>
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-bold mb-2">Processing Batch</h4>
                                                    <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-[var(--secondary)] to-[var(--primary)] transition-all duration-300"
                                                            style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-xs font-mono text-gray-400 mt-2">{uploadProgress.current} / {uploadProgress.total} Files</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* QR Code */}
                                    <button
                                        onClick={downloadQr}
                                        className="w-full glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:bg-white/5 transition-colors cursor-pointer"
                                    >
                                        <div className="bg-white p-3 rounded-xl mb-4 group-hover:scale-105 transition-transform">
                                            <QRCodeCanvas value={getEventLink(selectedEvent)} size={120} />
                                        </div>
                                        <p className="text-sm font-bold text-gray-300 group-hover:text-white">Attendee Access</p>
                                        <p className="text-xs text-gray-500 group-hover:text-[var(--primary)]">Click to Download High-Res</p>

                                        {/* Hidden High-Res QR */}
                                        <div className="hidden">
                                            <QRCodeCanvas
                                                id="high-res-qr"
                                                value={getEventLink(selectedEvent)}
                                                size={1000}
                                                level="H"
                                                includeMargin={true}
                                                bgColor="#ffffff"
                                                fgColor="#000000"
                                            />
                                        </div>
                                    </button>
                                </div>

                                {/* RIGHT COL: Gallery */}
                                <div className="col-span-12 lg:col-span-8">
                                    <div className="glass-panel rounded-2xl p-8 min-h-[600px] border-l-4 border-l-[var(--primary)]">
                                        <div className="flex items-center justify-between mb-8">
                                            <h3 className="text-2xl font-display font-bold flex items-center gap-3">
                                                <ImageIcon size={24} className="text-[var(--primary)]" />
                                                Live Gallery
                                            </h3>
                                            <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-mono">{photos.length} Photos</span>
                                        </div>

                                        {loadingPhotos ? (
                                            <div className="flex flex-col items-center justify-center py-40 text-gray-500 gap-4">
                                                <Loader2 className="animate-spin w-8 h-8" />
                                                <p className="text-sm font-mono">Fetching Assets...</p>
                                            </div>
                                        ) : photos.length === 0 ? (
                                            <div className="text-center py-40 border-2 border-dashed border-white/5 rounded-2xl">
                                                <p className="text-gray-500 font-bold text-lg mb-2">Gallery Empty</p>
                                                <p className="text-gray-600 text-sm">Upload photos to begin face recognition indexing.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {photos.map((photo) => (
                                                    <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-black/50 group border border-white/5 hover:border-[var(--primary)] transition-all bg-[#0a0a0a]">
                                                        <img src={photo.url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-70 group-hover:opacity-100" loading="lazy" />
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                                                            <a href={photo.url} target="_blank" className="p-3 bg-[var(--primary)] rounded-full text-black hover:scale-110 transition-transform font-bold">
                                                                <Eye size={18} />
                                                            </a>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <div className="w-24 h-24 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                <Layers size={48} className="text-[var(--primary)] text-opacity-50" />
                            </div>
                            <h2 className="text-3xl font-display font-bold text-white mb-2">Welcome Back</h2>
                            <p className="text-gray-400 max-w-md">Select an event from the sidebar to access the command center.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Modal */}
            {isCreating && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="glass-panel border-white/10 p-8 rounded-3xl w-full max-w-md relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"></div>
                        <h3 className="text-2xl font-display font-bold mb-6 text-white">Initialize New Event</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-mono text-gray-500 uppercase mb-2">Event Designation</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Neon Nights 2024"
                                    value={newEventName}
                                    onChange={e => setNewEventName(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-mono text-gray-500 uppercase mb-2">Banner Asset URL</label>
                                <input
                                    type="text"
                                    placeholder="https://"
                                    value={newEventBanner}
                                    onChange={e => setNewEventBanner(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none transition-all"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setIsCreating(false)} className="px-6 py-3 hover:bg-white/5 text-gray-400 hover:text-white rounded-xl transition-colors font-medium">Cancel</button>
                            <button onClick={createEvent} className="px-8 py-3 bg-[var(--primary)] hover:bg-[#00d0dd] text-black rounded-xl font-bold transition-all shadow-lg hover:shadow-[var(--primary)]/50">Create Event</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

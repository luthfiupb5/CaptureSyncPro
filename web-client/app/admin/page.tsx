"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import * as faceapi from 'face-api.js';
import { FaceMatcher } from "@/lib/matcher";
import {
    LayoutDashboard, Plus, Upload, Image as ImageIcon, Settings,
    LogOut, ChevronRight, Loader2, Zap, Wand2, Search,
    MoreVertical, Trash2, ExternalLink, QrCode, X, Check,
    LayoutGrid, List
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/lib/supabase";

// Types
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

    // Auth & Init State
    const [user, setUser] = useState<AuthUser | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [modelStatus, setModelStatus] = useState("Initializing AI...");

    // Data State
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);

    // UI State
    const [uploadMode, setUploadMode] = useState<'direct' | 'studio'>('direct');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isCreatingEvent, setIsCreatingEvent] = useState(false);
    const [newEventName, setNewEventName] = useState("");

    // Upload & Processing State
    const [uploadQueue, setUploadQueue] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const [processingStatus, setProcessingStatus] = useState("");

    // Studio Mode specific
    const [landscapeOverlay, setLandscapeOverlay] = useState<HTMLImageElement | null>(null);
    const [portraitOverlay, setPortraitOverlay] = useState<HTMLImageElement | null>(null);

    // Initial Load
    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (selectedEvent) fetchPhotos(selectedEvent.id);
        else setPhotos([]);
    }, [selectedEvent]);

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

            // Load AI Models
            try {
                await FaceMatcher.getInstance().loadModels();
                setModelStatus("AI Engine Ready");
            } catch (e) {
                console.error(e);
                setModelStatus("AI Engine Offline");
            }
        } catch (e) {
            router.push('/admin/login');
        } finally {
            setAuthLoading(false);
        }
    };

    const fetchEvents = async (currentUser: AuthUser) => {
        try {
            const res = await fetch('/api/events');
            let data: Event[] = await res.json();
            if (!Array.isArray(data)) data = [];

            if (currentUser.role === 'program_admin' && currentUser.eventId) {
                data = data.filter(e => e.id === currentUser.eventId);
                if (data.length > 0) setSelectedEvent(data[0]);
            }

            setEvents(data);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchPhotos = async (eventId: string) => {
        setLoadingPhotos(true);
        try {
            const res = await fetch(`/api/events/${eventId}/photos`);
            const data = await res.json();
            setPhotos(data);
        } catch (e) { console.error(e); }
        finally { setLoadingPhotos(false); }
    };

    const createEvent = async () => {
        if (!newEventName.trim()) return;
        try {
            const res = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newEventName })
            });
            const event = await res.json();
            setEvents([...events, event]);
            setIsCreatingEvent(false);
            setNewEventName("");
            setSelectedEvent(event);
        } catch (e) { alert("Failed to create event"); }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/admin/login');
    };

    // --- Upload Logic ---
    const handleFiles = (files: FileList | null) => {
        if (!files) return;
        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        setUploadQueue(imageFiles);
        processBatch(imageFiles);
    };

    const processBatch = async (files: File[]) => {
        if (!selectedEvent) return;
        setUploading(true);
        setUploadProgress({ current: 0, total: files.length });

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setProcessingStatus(`Processing ${file.name}...`);

            try {
                // 1. Face Detection
                const imgUrl = URL.createObjectURL(file);
                const img = await faceapi.fetchImage(imgUrl);
                const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
                const vectors = detections.map(d => Array.from(d.descriptor));

                let blobToUpload = file;

                // 2. Studio Mode Overlay (if enabled)
                if (uploadMode === 'studio') {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        const isLandscape = img.width > img.height;
                        const overlay = isLandscape ? landscapeOverlay : portraitOverlay;
                        if (overlay) {
                            ctx.drawImage(overlay, 0, 0, img.width, img.height);
                            // Convert canvas to blob
                            const processedBlob = await new Promise<Blob | null>(resolve =>
                                canvas.toBlob(resolve, 'image/jpeg', 0.95)
                            );
                            if (processedBlob) blobToUpload = new File([processedBlob], file.name, { type: 'image/jpeg' });
                        }
                    }
                }

                // 3. Upload DIRECTLY to Supabase (Bypass Vercel 4.5MB limit)
                const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
                const filePath = `${selectedEvent.id}/${filename}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('photos')
                    .upload(filePath, blobToUpload, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                // Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('photos')
                    .getPublicUrl(filePath);

                // 4. Register Metadata via API
                await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        publicUrl,
                        eventId: selectedEvent.id,
                        vectors
                    })
                });

                URL.revokeObjectURL(imgUrl);

            } catch (e) {
                console.error(`Failed to process ${file.name}`, e);
            }

            setUploadProgress(prev => ({ ...prev, current: i + 1 }));
        }

        setUploading(false);
        setUploadQueue([]);
        setProcessingStatus("");
        fetchPhotos(selectedEvent.id);
    };

    // --- Overlay Handlers ---
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

    if (authLoading) return (
        <div className="h-screen bg-[var(--background)] flex flex-col items-center justify-center gap-4 text-[var(--muted)]">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--foreground)]" />
            <p className="text-sm font-mono uppercase tracking-widest">Authenticating Secure Session</p>
        </div>
    );

    return (
        <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)] font-sans overflow-hidden">

            {/* --- SIDEBAR --- */}
            <aside className={`flex-shrink-0 bg-[var(--surface)] border-r border-[var(--border)] transition-all duration-300 flex flex-col ${sidebarCollapsed ? 'w-20 items-center' : 'w-72'}`}>
                {/* Brand */}
                <div className={`p-6 flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20">
                        C
                    </div>
                    {!sidebarCollapsed && (
                        <div>
                            <h1 className="font-bold text-sm leading-none">CaptureSync</h1>
                            <span className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-wider">PRO CONTROL</span>
                        </div>
                    )}
                </div>

                {/* Events List */}
                <div className="flex-1 overflow-y-auto px-3 space-y-1">
                    {!sidebarCollapsed && <div className="px-3 py-2 text-xs font-bold text-[var(--muted)] uppercase tracking-widest flex justify-between items-center group">
                        <span>Events</span>
                        {user?.role === 'super_admin' && (
                            <button onClick={() => setIsCreatingEvent(true)} className="hover:text-white transition-colors"><Plus size={14} /></button>
                        )}
                    </div>}

                    {events.map(ev => (
                        <button
                            key={ev.id}
                            onClick={() => setSelectedEvent(ev)}
                            title={ev.name}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium
                                ${selectedEvent?.id === ev.id
                                    ? 'bg-[var(--surface-highlight)] text-white border border-[var(--border)] shadow-sm'
                                    : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-highlight)]/50'
                                }
                                ${sidebarCollapsed ? 'justify-center' : ''}
                            `}
                        >
                            <span className={`w-2 h-2 rounded-full ${selectedEvent?.id === ev.id ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-zinc-700'}`}></span>
                            {!sidebarCollapsed && <span className="truncate">{ev.name}</span>}
                        </button>
                    ))}
                </div>

                {/* Footer User Profile */}
                <div className="p-4 border-t border-[var(--border)]">
                    <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-[var(--border)] flex items-center justify-center text-xs font-bold ring-2 ring-transparent group-hover:ring-indigo-500/20 transition-all">
                            {user?.role === 'super_admin' ? 'A' : 'P'}
                        </div>
                        {!sidebarCollapsed && (
                            <div className="flex-1 overflow-hidden">
                                <p className="text-xs font-medium truncate">Administrator</p>
                                <button onClick={handleLogout} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 mt-0.5">
                                    <LogOut size={10} /> Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 flex flex-col relative overflow-hidden bg-[var(--background)]">

                {selectedEvent ? (
                    <>
                        {/* Header Toolbar */}
                        <header className="h-16 border-b border-[var(--border)] px-6 flex items-center justify-between flex-shrink-0 bg-[var(--background)]/80 backdrop-blur-md z-10">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-display font-semibold text-[var(--foreground)]">{selectedEvent.name}</h2>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${modelStatus.includes("Ready") ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                                    {modelStatus}
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                <button onClick={() => window.open(`/?eventId=${selectedEvent.id}`, '_blank')} className="btn-icon text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-2 rounded-lg hover:bg-[var(--surface-highlight)]">
                                    <ExternalLink size={18} />
                                </button>
                                <button className="btn-secondary px-4 py-2 rounded-lg text-xs font-medium border border-[var(--border)] hover:bg-[var(--surface-highlight)] transition-colors flex items-center gap-2">
                                    <QrCode size={14} /> Get QR
                                </button>
                            </div>
                        </header>

                        {/* Scrollable Workspace */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">

                            {/* Stats Row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="glass-panel p-5 rounded-xl flex flex-col justify-between h-32 relative overflow-hidden group">
                                    <div className="relative z-10">
                                        <p className="text-[var(--muted)] text-xs font-medium uppercase tracking-wider">Total Photos</p>
                                        <h3 className="text-3xl font-display font-bold mt-2 text-[var(--foreground)]">{photos.length}</h3>
                                    </div>
                                    <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <ImageIcon size={64} />
                                    </div>
                                </div>
                                <div className="glass-panel p-5 rounded-xl flex flex-col justify-between h-32 relative overflow-hidden group">
                                    <div className="relative z-10">
                                        <p className="text-[var(--muted)] text-xs font-medium uppercase tracking-wider">Storage Usage</p>
                                        <h3 className="text-3xl font-display font-bold mt-2 text-[var(--foreground)]">{(photos.length * 2.4).toFixed(1)}<span className="text-sm font-sans text-[var(--muted)] ml-1">MB</span></h3>
                                    </div>
                                    <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Zap size={64} />
                                    </div>
                                </div>
                                <div className="glass-panel p-5 rounded-xl flex flex-col justify-between h-32 relative overflow-hidden group border-indigo-500/20">
                                    <div className="relative z-10">
                                        <p className="text-indigo-400 text-xs font-bold uppercase tracking-wider">System Status</p>
                                        <h3 className="text-3xl font-display font-bold mt-2 text-white flex items-center gap-2">
                                            Online <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        </h3>
                                    </div>
                                </div>
                            </div>

                            {/* UPLOAD & PROCESSING CONTROL */}
                            <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl shadow-black/20">
                                {/* Tab Switcher */}
                                <div className="flex border-b border-[var(--border)] bg-[var(--surface)]">
                                    <button
                                        onClick={() => setUploadMode('direct')}
                                        className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all relative
                                            ${uploadMode === 'direct' ? 'text-white' : 'text-[var(--muted)] hover:text-white'}
                                        `}
                                    >
                                        <Zap size={16} className={uploadMode === 'direct' ? 'text-indigo-400' : ''} /> Direct Upload
                                        {uploadMode === 'direct' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500"></div>}
                                    </button>
                                    <button
                                        onClick={() => setUploadMode('studio')}
                                        className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all relative
                                            ${uploadMode === 'studio' ? 'text-white' : 'text-[var(--muted)] hover:text-white'}
                                        `}
                                    >
                                        <Wand2 size={16} className={uploadMode === 'studio' ? 'text-pink-500' : ''} /> Studio Processing
                                        {uploadMode === 'studio' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500"></div>}
                                    </button>
                                </div>

                                <div className="p-8">
                                    {/* Upload Area */}
                                    {!uploading ? (
                                        <div className="space-y-6">
                                            {/* Studio Config - Only visible in studio mode */}
                                            {uploadMode === 'studio' && (
                                                <div className="grid grid-cols-2 gap-6 p-6 rounded-xl bg-[var(--background)] border border-[var(--border)] animate-fade-in">
                                                    <div>
                                                        <label className="text-xs font-bold text-[var(--muted)] uppercase mb-3 block">Landscape Overlay</label>
                                                        <input type="file" onChange={(e) => handleOverlaySelect(e, 'landscape')} className="text-sm text-[var(--muted)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20" />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-[var(--muted)] uppercase mb-3 block">Portrait Overlay</label>
                                                        <input type="file" onChange={(e) => handleOverlaySelect(e, 'portrait')} className="text-sm text-[var(--muted)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-pink-500/10 file:text-pink-400 hover:file:bg-pink-500/20" />
                                                    </div>
                                                </div>
                                            )}

                                            <div
                                                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer group
                                                    ${uploadMode === 'direct' ? 'border-indigo-500/30 hover:border-indigo-500 hover:bg-indigo-500/5' : 'border-pink-500/30 hover:border-pink-500 hover:bg-pink-500/5'}
                                                `}
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                                                onClick={() => document.getElementById('fileUpload')?.click()}
                                            >
                                                <input id="fileUpload" type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                                                <div className="w-16 h-16 rounded-full bg-[var(--surface-highlight)] flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                                    <Upload size={24} className={uploadMode === 'direct' ? 'text-indigo-400' : 'text-pink-400'} />
                                                </div>
                                                <h3 className="text-lg font-medium text-[var(--foreground)]">Drop files here or click to browse</h3>
                                                <p className="text-sm text-[var(--muted)] mt-1">Supports JPG, PNG • Batch Processing Ready</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center">
                                            <div className="w-16 h-16 rounded-full border-4 border-[var(--surface-highlight)] border-t-indigo-500 animate-spin mx-auto mb-6"></div>
                                            <h3 className="text-xl font-medium animate-pulse">Processing Batch...</h3>
                                            <div className="max-w-md mx-auto mt-4 space-y-2">
                                                <div className="h-1.5 w-full bg-[var(--surface-highlight)] rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}></div>
                                                </div>
                                                <p className="text-xs text-[var(--muted)] font-mono">{uploadProgress.current} / {uploadProgress.total} Files • {processingStatus}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* GALLERY GRID */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-medium flex items-center gap-2"><ImageIcon size={18} className="text-[var(--muted)]" /> Live Gallery</h3>
                                    <div className="flex gap-2">
                                        <button className="p-2 text-[var(--muted)] hover:text-white transition-colors"><LayoutGrid size={18} /></button>
                                    </div>
                                </div>

                                {loadingPhotos ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {[1, 2, 3, 4, 5, 6].map(i => (
                                            <div key={i} className="aspect-square bg-[var(--surface-highlight)] rounded-lg animate-pulse"></div>
                                        ))}
                                    </div>
                                ) : photos.length === 0 ? (
                                    <div className="py-20 text-center text-[var(--muted)] border border-dashed border-[var(--border)] rounded-xl bg-[var(--surface)]/30">
                                        <p>No photos have been uploaded yet.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {photos.map(p => (
                                            <div key={p.id} className="relative aspect-square group rounded-lg overflow-hidden bg-[var(--surface-highlight)] border border-[var(--border)]">
                                                <img src={p.url} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <a href={p.url} target="_blank" className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform"><ExternalLink size={14} /></a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted)]">
                        <div className="w-24 h-24 bg-[var(--surface-highlight)] rounded-full flex items-center justify-center mb-6">
                            <Settings size={32} className="opacity-50" />
                        </div>
                        <h2 className="text-2xl font-display font-bold text-[var(--foreground)] mb-2">No Event Selected</h2>
                        <p className="max-w-xs text-center">Select an existing event from the sidebar or create a new one to begin.</p>
                    </div>
                )}
            </main>

            {/* CREATE MODAL */}
            {isCreatingEvent && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
                    <div className="glass-panel w-full max-w-sm rounded-xl p-6 shadow-2xl animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold">New Event</h3>
                            <button onClick={() => setIsCreatingEvent(false)}><X size={18} className="text-[var(--muted)] hover:text-white" /></button>
                        </div>
                        <input
                            autoFocus
                            placeholder="Event Name (e.g. Summer Gala)"
                            value={newEventName}
                            onChange={(e) => setNewEventName(e.target.value)}
                            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-indigo-500 outline-none mb-6"
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setIsCreatingEvent(false)} className="px-4 py-2 text-xs font-medium text-[var(--muted)] hover:text-white transition-colors">Cancel</button>
                            <button onClick={createEvent} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-500/20">Create Event</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

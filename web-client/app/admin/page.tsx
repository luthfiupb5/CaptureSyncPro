"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import * as faceapi from 'face-api.js';
import { FaceMatcher } from "@/lib/matcher";
import {
    LayoutDashboard, Plus, Upload, Image as ImageIcon, Settings,
    LogOut, ChevronRight, Loader2, Zap, Wand2, Search,
    MoreVertical, Trash2, ExternalLink, QrCode, X, Check,
    LayoutGrid, List, Copy, Key
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import imageCompression from 'browser-image-compression';

interface Event {
    id: string;
    name: string;
    banner?: string;
    credentials?: { username: string; password: string };
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
    const [modelStatus, setModelStatus] = useState("Initializing AI...");


    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);

    const [newCreds, setNewCreds] = useState<{ username: string, password: string } | null>(null);
    const [showCredsModal, setShowCredsModal] = useState(false);
    const [viewingCreds, setViewingCreds] = useState<{ username: string, password: string } | null>(null);
    const [showQRModal, setShowQRModal] = useState(false);

    const [uploadMode, setUploadMode] = useState<'direct' | 'studio'>('direct');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isCreatingEvent, setIsCreatingEvent] = useState(false);
    const [newEventName, setNewEventName] = useState("");

    const [uploadQueue, setUploadQueue] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const [processingStatus, setProcessingStatus] = useState("");

    const [landscapeOverlay, setLandscapeOverlay] = useState<HTMLImageElement | null>(null);
    const [portraitOverlay, setPortraitOverlay] = useState<HTMLImageElement | null>(null);

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
            let data = await res.json();
            if (!Array.isArray(data)) data = [];

            if (currentUser.role === 'program_admin' && currentUser.eventId) {





                const myEvent = data.find((e: any) => e.id === currentUser.eventId);
                if (myEvent) {
                    setEvents([myEvent]);
                    setSelectedEvent(myEvent);
                } else {
                    setEvents([]);
                }
            } else {
                setEvents(data);
            }
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
            const result = await res.json();

            setEvents([...events, result.event]);
            setIsCreatingEvent(false);
            setNewEventName("");

            setNewCreds(result.credentials);
            setShowCredsModal(true);

            setSelectedEvent(result.event);
        } catch (e) { alert("Failed to create event"); }
    };


    const deleteEvent = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this event? This will permanently delete all photos.")) return;

        try {
            const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setEvents(events.filter(e => e.id !== id));
                if (selectedEvent?.id === id) {
                    setSelectedEvent(null);
                    setPhotos([]);
                }
            } else {
                alert("Failed to delete event");
            }
        } catch (e) { console.error(e); }
    };

    const deletePhoto = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Delete this photo permanently?")) return;

        try {
            const res = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setPhotos(photos.filter(p => p.id !== id));
            } else {
                alert("Failed to delete photo");
            }
        } catch (e) { console.error(e); }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/admin/login');
    };

    const downloadQR = () => {
        const canvas = document.getElementById('event-qr-code') as HTMLCanvasElement;
        if (canvas) {
            const pngUrl = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `${selectedEvent?.name || 'event'}-qr.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    };

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
                const imgUrl = URL.createObjectURL(file);
                const img = await faceapi.fetchImage(imgUrl);

                const detectionScale = 800 / Math.max(img.width, img.height);
                const useScale = detectionScale < 1 ? detectionScale : 1;

                let detectionInput: HTMLCanvasElement | HTMLImageElement = img;

                if (useScale < 1) {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width * useScale;
                    canvas.height = img.height * useScale;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        detectionInput = canvas;
                    }
                }

                const detections = await faceapi.detectAllFaces(detectionInput).withFaceLandmarks().withFaceDescriptors();
                const vectors = detections.map(d => Array.from(d.descriptor));

                let blobToUpload = file;

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
                            const processedBlob = await new Promise<Blob | null>(resolve =>
                                canvas.toBlob(resolve, 'image/jpeg', 1.0)
                            );
                            if (processedBlob) blobToUpload = new File([processedBlob], file.name, { type: 'image/jpeg' });
                        }
                    }
                }

                const formData = new FormData();
                formData.append('file', blobToUpload);
                formData.append('eventId', selectedEvent.id);
                formData.append('vectors', JSON.stringify(vectors));

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) throw new Error('Upload failed');

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

            <aside className={`flex-shrink-0 bg-[var(--surface)]/80 backdrop-blur-xl border-r border-[var(--border)] transition-all duration-300 flex flex-col relative z-20 ${sidebarCollapsed ? 'w-20 items-center' : 'w-72'}`}>
                <div className={`p-6 flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                        <Zap size={20} className="fill-white" />
                    </div>
                    {!sidebarCollapsed && (
                        <div>
                            <h1 className="font-display font-bold text-xl leading-none tracking-tight">CaptureSync</h1>
                            <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-widest">Administrator</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-4 space-y-2 py-4">
                    {!sidebarCollapsed && <div className="px-2 pb-2 text-xs font-bold text-[var(--muted)] uppercase tracking-widest flex justify-between items-center group">
                        <span>Active Events</span>
                        {user?.role === 'super_admin' && (
                            <button onClick={() => setIsCreatingEvent(true)} className="hover:text-white transition-colors p-1 hover:bg-white/10 rounded"><Plus size={14} /></button>
                        )}
                    </div>}

                    {events.map(ev => (
                        <div key={ev.id} className="relative group">
                            <button
                                onClick={() => setSelectedEvent(ev)}
                                title={ev.name}
                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-sm font-medium border border-transparent
                                    ${selectedEvent?.id === ev.id
                                        ? 'bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-white border-indigo-500/20 shadow-sm'
                                        : 'text-[var(--muted)] hover:text-white hover:bg-white/5'
                                    }
                                    ${sidebarCollapsed ? 'justify-center px-0' : ''}
                                `}
                            >
                                <span className={`w-2 h-2 rounded-full ${selectedEvent?.id === ev.id ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'bg-zinc-700'}`}></span>
                                {!sidebarCollapsed && <span className="truncate flex-1 text-left">{ev.name}</span>}
                            </button>
                            {!sidebarCollapsed && user?.role === 'super_admin' && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // @ts-ignore
                                            if (ev.credentials) {
                                                setViewingCreds(ev.credentials);
                                            } else {
                                                alert("No credentials found for this event");
                                            }
                                        }}
                                        className="p-1.5 text-zinc-500 hover:text-indigo-400"
                                        title="View Login IDs"
                                    >
                                        <div className="w-3.5 h-3.5"><Key size={14} /></div>
                                    </button>
                                    <button
                                        onClick={(e) => deleteEvent(e, ev.id)}
                                        className="p-1.5 text-zinc-500 hover:text-red-400"
                                        title="Delete Event"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-[var(--border)] bg-black/20">
                    <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-[var(--border)] flex items-center justify-center text-sm font-bold text-white shadow-inner">
                            {user?.role === 'super_admin' ? 'A' : 'P'}
                        </div>
                        {!sidebarCollapsed && (
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-medium text-white truncate">Admin Console</p>
                                <button onClick={handleLogout} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 mt-0.5 transition-colors">
                                    <LogOut size={10} /> Sign Out securely
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col relative overflow-hidden bg-[var(--background)]">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>

                {selectedEvent ? (
                    <>
                        <header className="h-20 border-b border-[var(--border)] px-8 flex items-center justify-between flex-shrink-0 bg-[var(--surface)]/50 backdrop-blur-md z-10 sticky top-0">
                            <div className="flex items-center gap-4">
                                <h2 className="text-2xl font-display font-bold text-white tracking-tight">{selectedEvent.name}</h2>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono border flex items-center gap-1.5 ${modelStatus.includes("Ready") ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${modelStatus.includes("Ready") ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                    {modelStatus}
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                <button onClick={() => window.open(`/?eventId=${selectedEvent.id}`, '_blank')} className="btn-icon text-[var(--muted)] hover:text-white transition-colors p-2.5 rounded-xl hover:bg-white/10" title="Open Public View">
                                    <ExternalLink size={18} />
                                </button>
                                <button onClick={() => setShowQRModal(true)} className="px-4 py-2 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/5 transition-all flex items-center gap-2 hover:border-white/20">
                                    <QrCode size={14} /> <span className="hidden sm:inline">Get QR Code</span>
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8 cursor-default">

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between h-36 relative overflow-hidden group hover:border-indigo-500/30">
                                    <div className="relative z-10">
                                        <p className="text-[var(--muted)] text-xs font-bold uppercase tracking-wider">Total Photos</p>
                                        <h3 className="text-4xl font-display font-bold mt-2 text-white group-hover:scale-105 transition-transform origin-left">{photos.length}</h3>
                                    </div>
                                    <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity duration-500">
                                        <ImageIcon size={80} />
                                    </div>
                                </div>
                                <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between h-36 relative overflow-hidden group hover:border-indigo-500/30">
                                    <div className="relative z-10">
                                        <p className="text-[var(--muted)] text-xs font-bold uppercase tracking-wider">Storage Usage</p>
                                        <h3 className="text-4xl font-display font-bold mt-2 text-white group-hover:scale-105 transition-transform origin-left">{(photos.length * 2.4).toFixed(1)}<span className="text-lg font-sans text-[var(--muted)] ml-1 font-medium">MB</span></h3>
                                    </div>
                                    <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity duration-500">
                                        <Zap size={80} />
                                    </div>
                                </div>
                                <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between h-36 relative overflow-hidden group border-indigo-500/20 hover:shadow-[0_0_30px_rgba(99,102,241,0.1)]">
                                    <div className="relative z-10">
                                        <p className="text-indigo-400 text-xs font-bold uppercase tracking-wider">System Status</p>
                                        <div className="mt-2 flex items-center gap-3">
                                            <span className="relative flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                            </span>
                                            <h3 className="text-2xl font-display font-bold text-white">Online</h3>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border-white/5">
                                <div className="flex border-b border-white/5 bg-black/20">
                                    <button
                                        onClick={() => setUploadMode('direct')}
                                        className={`flex-1 py-5 flex items-center justify-center gap-2.5 text-sm font-bold transition-all relative
                                            ${uploadMode === 'direct' ? 'text-white bg-white/5' : 'text-[var(--muted)] hover:text-white hover:bg-white/5'}
                                        `}
                                    >
                                        <Zap size={16} className={uploadMode === 'direct' ? 'text-indigo-400' : ''} /> Direct Upload
                                        {uploadMode === 'direct' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_-2px_10px_rgba(99,102,241,0.5)]"></div>}
                                    </button>
                                    <button
                                        onClick={() => setUploadMode('studio')}
                                        className={`flex-1 py-5 flex items-center justify-center gap-2.5 text-sm font-bold transition-all relative
                                            ${uploadMode === 'studio' ? 'text-white bg-white/5' : 'text-[var(--muted)] hover:text-white hover:bg-white/5'}
                                        `}
                                    >
                                        <Wand2 size={16} className={uploadMode === 'studio' ? 'text-pink-500' : ''} /> Studio Processing
                                        {uploadMode === 'studio' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 shadow-[0_-2px_10px_rgba(236,72,153,0.5)]"></div>}
                                    </button>
                                </div>

                                <div className="p-10">
                                    {!uploading ? (
                                        <div className="space-y-8">
                                            {uploadMode === 'studio' && (
                                                <div className="grid grid-cols-2 gap-6 p-6 rounded-2xl bg-black/20 border border-white/5 animate-fade-in">
                                                    <div>
                                                        <label className="text-xs font-bold text-[var(--muted)] uppercase mb-3 block">Landscape Overlay</label>
                                                        <input type="file" onChange={(e) => handleOverlaySelect(e, 'landscape')} className="text-sm text-[var(--muted)] file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 transition-all cursor-pointer" />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-[var(--muted)] uppercase mb-3 block">Portrait Overlay</label>
                                                        <input type="file" onChange={(e) => handleOverlaySelect(e, 'portrait')} className="text-sm text-[var(--muted)] file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-pink-500/10 file:text-pink-400 hover:file:bg-pink-500/20 transition-all cursor-pointer" />
                                                    </div>
                                                </div>
                                            )}

                                            <div
                                                className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer group relative overflow-hidden
                                                    ${uploadMode === 'direct' ? 'border-indigo-500/20 hover:border-indigo-500/50 hover:bg-indigo-500/5' : 'border-pink-500/20 hover:border-pink-500/50 hover:bg-pink-500/5'}
                                                `}
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                                                onClick={() => document.getElementById('fileUpload')?.click()}
                                            >
                                                <input id="fileUpload" type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                                                <div className="w-20 h-20 rounded-full bg-[var(--surface-highlight)] flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg">
                                                    <Upload size={32} className={uploadMode === 'direct' ? 'text-indigo-400' : 'text-pink-400'} />
                                                </div>
                                                <h3 className="text-xl font-bold text-white mb-2">Drop files here or click to browse</h3>
                                                <p className="text-sm text-[var(--muted)]">Supports JPG, PNG • Batch Processing Ready</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-16 text-center">
                                            <div className="relative w-20 h-20 mx-auto mb-8">
                                                <div className="absolute inset-0 rounded-full border-4 border-[var(--surface-highlight)]"></div>
                                                <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin"></div>
                                                <Zap className="absolute inset-0 m-auto text-white animate-pulse" size={24} />
                                            </div>
                                            <h3 className="text-2xl font-bold text-white mb-2 animate-pulse">Processing Batch...</h3>
                                            <p className="text-[var(--muted)] mb-8">Optimizing, analyzing, and indexing content.</p>

                                            <div className="max-w-md mx-auto space-y-3">
                                                <div className="h-2 w-full bg-[var(--surface-highlight)] rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300 relative" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}>
                                                        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white/50 to-transparent"></div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between text-xs font-mono text-[var(--muted)]">
                                                    <span>{uploadProgress.current} / {uploadProgress.total} Files</span>
                                                    <span>{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
                                                </div>
                                                <p className="text-xs text-indigo-400 font-mono mt-2">{processingStatus}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold flex items-center gap-2 text-white"><ImageIcon size={20} className="text-indigo-400" /> Live Gallery</h3>
                                    <div className="flex gap-2">
                                        <button className="p-2 text-[var(--muted)] hover:text-white transition-colors bg-white/5 rounded-lg"><LayoutGrid size={18} /></button>
                                    </div>
                                </div>

                                {loadingPhotos ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                        {[1, 2, 3, 4, 5, 6].map(i => (
                                            <div key={i} className="aspect-square bg-[var(--surface-highlight)] rounded-2xl animate-pulse"></div>
                                        ))}
                                    </div>
                                ) : photos.length === 0 ? (
                                    <div className="py-32 text-center text-[var(--muted)] border-2 border-dashed border-[var(--border)] rounded-2xl bg-[var(--surface)]/20">
                                        <p>No photos have been uploaded yet.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                        {photos.map(p => (
                                            <div key={p.id} className="relative aspect-square group rounded-2xl overflow-hidden bg-[var(--surface-highlight)] border border-white/5 hover:border-indigo-500/50 transition-all shadow-lg hover:shadow-indigo-500/20">
                                                <img src={p.url} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:scale-105" loading="lazy" />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                                                    <a href={p.url} target="_blank" className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-lg"><ExternalLink size={16} /></a>
                                                    <button onClick={(e) => deletePhoto(e, p.id)} className="p-3 bg-red-500 text-white rounded-full hover:scale-110 transition-transform shadow-lg"><Trash2 size={16} /></button>
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
                        <div className="w-28 h-28 bg-[var(--surface-highlight)] rounded-full flex items-center justify-center mb-8 animate-pulse-ring">
                            <Settings size={40} className="opacity-50" />
                        </div>
                        <h2 className="text-3xl font-display font-bold text-white mb-3">No Event Selected</h2>
                        <p className="max-w-xs text-center leading-relaxed">Select an existing event from the sidebar or create a new one to begin managing.</p>
                    </div>
                )}
            </main>

            {isCreatingEvent && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center animate-fade-in">
                    <div className="glass-panel w-full max-w-sm rounded-2xl p-8 shadow-2xl animate-scale-in border border-white/10">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-display font-bold text-white">Create New Event</h3>
                            <button onClick={() => setIsCreatingEvent(false)}><X size={20} className="text-[var(--muted)] hover:text-white transition-colors" /></button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2 block">Event Name</label>
                                <input
                                    autoFocus
                                    placeholder="e.g. Summer Gala 2024"
                                    value={newEventName}
                                    onChange={(e) => setNewEventName(e.target.value)}
                                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500/50 outline-none transition-all placeholder:text-white/20"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button onClick={() => setIsCreatingEvent(false)} className="px-5 py-2.5 text-xs font-medium text-[var(--muted)] hover:text-white transition-colors">Cancel</button>
                                <button
                                    onClick={createEvent}
                                    disabled={!newEventName.trim()}
                                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Create Event
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showCredsModal && newCreds && (
                <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center animate-fade-in p-4">
                    <div className="glass-panel w-full max-w-md rounded-2xl p-8 shadow-2xl animate-scale-in border border-indigo-500/30">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                                <Check size={32} className="text-green-500" />
                            </div>
                            <h3 className="text-2xl font-display font-bold text-white">Event Created!</h3>
                            <p className="text-[var(--muted)] text-sm mt-2">Share these credentials with your event coordinator.</p>
                        </div>

                        <div className="bg-black/40 rounded-xl p-6 space-y-4 border border-white/5">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-[var(--muted)] tracking-wider">Username</label>
                                <div className="flex justify-between items-center mt-1 group cursor-pointer" onClick={() => navigator.clipboard.writeText(newCreds.username)}>
                                    <code className="text-lg font-mono text-indigo-300">{newCreds.username}</code>
                                    <Copy size={16} className="text-white/20 group-hover:text-white transition-colors" />
                                </div>
                            </div>
                            <div className="h-px bg-white/10"></div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-[var(--muted)] tracking-wider">Password</label>
                                <div className="flex justify-between items-center mt-1 group cursor-pointer" onClick={() => navigator.clipboard.writeText(newCreds.password)}>
                                    <code className="text-lg font-mono text-white">{newCreds.password}</code>
                                    <Copy size={16} className="text-white/20 group-hover:text-white transition-colors" />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowCredsModal(false)}
                            className="w-full mt-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

            {viewingCreds && (
                <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center animate-fade-in p-4" onClick={() => setViewingCreds(null)}>
                    <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in border border-white/10" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-lg font-bold text-white">Admin Credentials</h3>
                            <button onClick={() => setViewingCreds(null)}><X size={18} className="text-[var(--muted)] hover:text-white" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 bg-white/5 rounded-lg border border-white/5 group cursor-pointer hover:bg-white/10 transition-colors" onClick={() => {
                                navigator.clipboard.writeText(viewingCreds.username);
                                alert("Username copied!");
                            }}>
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-xs text-[var(--muted)] uppercase tracking-wider">Username</p>
                                    <Copy size={12} className="text-white/20 group-hover:text-white transition-colors" />
                                </div>
                                <p className="font-mono text-indigo-300 select-all">{viewingCreds.username}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg border border-white/5 group cursor-pointer hover:bg-white/10 transition-colors" onClick={() => {
                                navigator.clipboard.writeText(viewingCreds.password);
                                alert("Password copied!");
                            }}>
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-xs text-[var(--muted)] uppercase tracking-wider">Password</p>
                                    <Copy size={12} className="text-white/20 group-hover:text-white transition-colors" />
                                </div>
                                <p className="font-mono text-white select-all">{viewingCreds.password}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showQRModal && selectedEvent && (
                <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center animate-fade-in p-4" onClick={() => setShowQRModal(false)}>
                    <div className="glass-panel w-full max-w-sm rounded-2xl p-8 shadow-2xl animate-scale-in border border-white/10 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-display font-bold text-white">Event QR Code</h3>
                            <button onClick={() => setShowQRModal(false)}><X size={20} className="text-[var(--muted)] hover:text-white transition-colors" /></button>
                        </div>

                        <div className="bg-white p-4 rounded-xl mx-auto w-fit mb-8 shadow-xl shadow-white/5">
                            <QRCodeCanvas
                                id="event-qr-code"
                                value={`${window.location.origin}/?eventId=${selectedEvent.id}`}
                                size={200}
                                level={"H"}
                                includeMargin={true}
                            />
                        </div>

                        <p className="text-sm text-[var(--muted)] mb-6">
                            Scan this code to instantly access the public gallery for <strong>{selectedEvent.name}</strong>.
                        </p>

                        <button
                            onClick={downloadQR}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            <Upload className="rotate-180" size={16} /> Download PNG
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

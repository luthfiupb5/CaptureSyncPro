"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import * as faceapi from 'face-api.js';
import { FaceMatcher } from "@/lib/matcher";
import { Upload, Plus, ExternalLink, Loader2, Image as ImageIcon, Copy, FolderInput, Layers, Trash2, Eye, LogOut, User, ImagePlus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

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
            fetchEvents(data.user); // Pass user to filter events immediately
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
                // Auto-select their event
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
            // Filter for images only
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
                    // Send the processed blob, but keep original filename
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

        // Refresh photos
        fetchPhotos(selectedEvent.id);
        alert("Batch Processing Complete!");
    };

    const getEventLink = (event: Event) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return `${origin}/?eventId=${event.id}`;
    };

    if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <main className="min-h-screen bg-black text-white font-sans flex">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/10 p-6 flex flex-col">
                <h1 className="text-2xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                    CaptureSync Pro
                </h1>

                <div className="flex-1 overflow-y-auto space-y-2">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Events</h2>
                    {loading ? <Loader2 className="animate-spin text-gray-500" /> : (
                        events.map(ev => (
                            <button
                                key={ev.id}
                                onClick={() => setSelectedEvent(ev)}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${selectedEvent?.id === ev.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                            >
                                {ev.name}
                            </button>
                        ))
                    )}
                </div>

                {user?.role === 'super_admin' && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="mt-6 w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-lg transition-colors font-medium"
                    >
                        <Plus size={18} /> New Event
                    </button>
                )}

                <div className="mt-8 pt-6 border-t border-white/10">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center font-bold">
                            {user?.role === 'super_admin' ? 'A' : 'P'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate">Admin</p>
                            <p className="text-xs text-gray-500 truncate capitalize">{user?.role.replace('_', ' ')}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-lg transition-colors text-sm"
                    >
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 p-8 bg-gray-900/50 overflow-y-auto">
                {selectedEvent ? (
                    <div className="max-w-6xl mx-auto space-y-8">
                        {/* Header */}
                        <header className="flex justify-between items-start">
                            <div>
                                <h2 className="text-4xl font-bold mb-2">{selectedEvent.name}</h2>
                                <p className="text-gray-400 font-mono text-sm">ID: {selectedEvent.id}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                {user?.role === 'super_admin' && (
                                    <button
                                        onClick={deleteEvent}
                                        className="text-red-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1 rounded text-sm flex items-center gap-1 transition-colors"
                                    >
                                        <Trash2 size={16} /> Delete Event
                                    </button>
                                )}

                                <div className="flex items-center gap-2">
                                    <QRCodeSVG value={getEventLink(selectedEvent)} size={80} className="bg-white p-2 rounded-lg" />
                                </div>
                                <button
                                    onClick={() => navigator.clipboard.writeText(getEventLink(selectedEvent))}
                                    className="text-xs flex items-center gap-1 text-blue-400 hover:underline"
                                >
                                    <Copy size={12} /> Copy Link
                                </button>
                            </div>
                        </header>

                        <div className="grid lg:grid-cols-3 gap-8">
                            {/* LEFT COL: Config & Upload */}
                            <div className="lg:col-span-1 space-y-6">
                                {/* 1. Configuration Section */}
                                <div className="bg-black border border-white/10 rounded-2xl p-6">
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <Layers size={20} className="text-blue-500" />
                                        Overlays
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-2">Landscape (PNG)</label>
                                            <div className="flex items-center gap-3">
                                                <input type="file" accept="image/png" onChange={(e) => handleOverlaySelect(e, 'landscape')} className="text-xs text-gray-500 w-full" />
                                                {landscapeOverlay && <div className="text-green-500">✓</div>}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-2">Portrait (PNG)</label>
                                            <div className="flex items-center gap-3">
                                                <input type="file" accept="image/png" onChange={(e) => handleOverlaySelect(e, 'portrait')} className="text-xs text-gray-500 w-full" />
                                                {portraitOverlay && <div className="text-green-500">✓</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Upload Section */}
                                <div className="bg-black border border-white/10 rounded-2xl p-6">
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <Upload size={20} className="text-purple-500" />
                                        Upload Photos
                                    </h3>

                                    {!uploading ? (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Single/Multiple Files */}
                                                <div className="border border-dashed border-gray-700 rounded-xl p-4 text-center hover:bg-white/5 transition-colors cursor-pointer relative group">
                                                    <input type="file" multiple accept="image/*" onChange={handleFolderSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                                                    <ImagePlus className="mx-auto text-gray-600 mb-2 group-hover:text-white transition-colors" size={24} />
                                                    <p className="font-medium text-gray-300 text-xs">Upload Files</p>
                                                </div>

                                                {/* Folder Upload */}
                                                <div className="border border-dashed border-gray-700 rounded-xl p-4 text-center hover:bg-white/5 transition-colors cursor-pointer relative group">
                                                    {/* @ts-ignore: webkitdirectory */}
                                                    <input type="file" multiple webkitdirectory="" onChange={handleFolderSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                                                    <FolderInput className="mx-auto text-gray-600 mb-2 group-hover:text-white transition-colors" size={24} />
                                                    <p className="font-medium text-gray-300 text-xs">Upload Folder</p>
                                                </div>
                                            </div>
                                            <p className="text-xs text-center text-gray-600">Drag & drop also supported</p>
                                        </div>
                                    ) : (
                                        <div className="p-4 text-center space-y-4">
                                            <Loader2 className="mx-auto animate-spin text-purple-500" size={32} />
                                            <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-purple-500 transition-all duration-300"
                                                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-gray-400">{uploadProgress.current} / {uploadProgress.total} - {processingStatus}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT COL: Gallery */}
                            <div className="lg:col-span-2">
                                <div className="bg-gray-900/30 border border-white/5 rounded-2xl p-6 min-h-[500px]">
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <ImageIcon size={20} className="text-green-500" />
                                        Photo Gallery ({photos.length})
                                    </h3>

                                    {loadingPhotos ? (
                                        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-500" /></div>
                                    ) : photos.length === 0 ? (
                                        <div className="text-center py-20 text-gray-600">
                                            <p>No photos uploaded yet.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {photos.map((photo) => (
                                                <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-800 group">
                                                    <img src={photo.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <a href={photo.url} target="_blank" className="p-2 bg-white/10 rounded-full hover:bg-white/30 text-white">
                                                            <Eye size={16} />
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
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <p>Select an event to manage</p>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isCreating && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-gray-900 border border-white/10 p-8 rounded-2xl w-full max-w-md">
                        <h3 className="text-2xl font-bold mb-6">Create New Event</h3>
                        <input
                            type="text"
                            placeholder="Event Name (e.g. Wedding 2024)"
                            value={newEventName}
                            onChange={e => setNewEventName(e.target.value)}
                            className="w-full bg-black border border-gray-700 rounded-lg p-3 mb-4 focus:ring-2 ring-purple-500 outline-none"
                            autoFocus
                        />
                        <input
                            type="text"
                            placeholder="Banner URL (Optional)"
                            value={newEventBanner}
                            onChange={e => setNewEventBanner(e.target.value)}
                            className="w-full bg-black border border-gray-700 rounded-lg p-3 mb-6 focus:ring-2 ring-purple-500 outline-none"
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setIsCreating(false)} className="px-4 py-2 hover:bg-white/10 rounded-lg transition-colors">Cancel</button>
                            <button onClick={createEvent} className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold transition-colors">Create</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

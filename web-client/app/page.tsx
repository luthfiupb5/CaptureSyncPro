"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, Search, Download, X, Upload, Image } from "lucide-react";
import * as faceapi from 'face-api.js';
import { FaceMatcher } from "@/lib/matcher";

type Step = "LANDING" | "CAMERA" | "RESULTS" | "ALL_PHOTOS";

interface Event {
  id: string;
  name: string;
  banner?: string;
}

// ... imports ...
function EventPage() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("LANDING");
  const [selfie, setSelfie] = useState<string | null>(null);
  const [matches, setMatches] = useState<string[]>([]);
  const [allPhotos, setAllPhotos] = useState<{ id: string, url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [showInputOptions, setShowInputOptions] = useState(false);

  // Event State
  const [eventData, setEventData] = useState<Event | null>(null);
  const eventId = searchParams.get("eventId");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 1. Initial Load: Models
    setStatus("Initializing AI Core...");
    FaceMatcher.getInstance().loadModels().then(() => setStatus("System Ready"));

    // 2. Fetch Event Data
    if (eventId) {
      fetch('/api/events')
        .then(res => res.json())
        .then(data => {
          const found = data.find((e: Event) => e.id === eventId);
          if (found) setEventData(found);
        })
        .catch(console.error);
    }
  }, [eventId]);

  const startCamera = async () => {
    setStep("CAMERA");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera");
    }
  };

  const captureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const vid = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = vid.videoWidth;
      canvas.height = vid.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(vid, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setSelfie(dataUrl);

      // Stop stream
      const stream = vid.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());

      findPhotos(dataUrl);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const dataUrl = ev.target.result as string;
          setSelfie(dataUrl);
          findPhotos(dataUrl);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const findPhotos = async (selfieUrl: string) => {
    if (!eventId) {
      alert("No Event ID found!");
      return;
    }

    setLoading(true);
    setStatus("Analyzing Biometrics...");
    try {
      // 1. Get Vector (Client Side)
      const img = await faceapi.fetchImage(selfieUrl);
      const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

      if (!detection) {
        alert("No face detected in selfie! Try better lighting.");
        setStep("LANDING");
        setLoading(false);
        return;
      }

      const vector = Array.from(detection.descriptor);

      // 2. Search API
      setStatus("Scanning Database...");
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, vector })
      });

      const data = await res.json();
      if (data.matches) {
        setMatches(data.matches);
        setStep("RESULTS");
      } else {
        alert("Search failed");
      }

    } catch (e) {
      console.error(e);
      alert("Error searching photos: " + e);
      setStep("LANDING");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPhotos = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/photos`);
      const data = await res.json();
      setAllPhotos(data);
      setStep("ALL_PHOTOS");
    } catch (e) {
      console.error(e);
      alert("Failed to load photos");
    } finally {
      setLoading(false);
    }
  };

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const downloadImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `event-photo-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Download failed", e);
      window.open(url, '_blank');
    }
  };

  return (
    <main className="relative min-h-screen text-white font-sans overflow-hidden">

      {/* Full Screen Analyzing Overlay */}
      {loading && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300 cursor-wait">
          <button
            onClick={() => setLoading(false)}
            className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:rotate-90 z-20 cursor-pointer"
          >
            <X size={24} />
          </button>
          <div className="relative">
            {/* Outer Rings */}
            <div className="w-64 h-64 rounded-full border border-white/10 animate-[spin_3s_linear_infinite]"></div>
            <div className="absolute inset-0 w-64 h-64 rounded-full border-t-2 border-[var(--primary)] animate-[spin_2s_linear_infinite]"></div>
            <div className="absolute inset-4 w-56 h-56 rounded-full border border-white/10 animate-[spin_3s_linear_infinite_reverse]"></div>

            {/* Inner Core */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-[var(--primary)]/10 rounded-full blur-xl animate-pulse"></div>
              <FaceMatcherIcon className="w-16 h-16 text-[var(--primary)] animate-bounce" />
            </div>

            {/* Scanning Laser */}
            <div className="absolute inset-0 w-full h-2 bg-[var(--secondary)] blur-sm animate-[scan_1.5s_ease-in-out_infinite] opacity-50"></div>
          </div>

          <div className="mt-12 text-center space-y-2">
            <h2 className="text-3xl font-display font-bold text-white tracking-[0.2em] animate-pulse">ANALYZING</h2>
            <p className="text-[var(--primary)] font-mono text-sm">{status}</p>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:rotate-90 z-20"
          >
            <X size={24} />
          </button>
          <div className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center">
            <img
              src={lightboxImage}
              alt="Full View"
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl ring-1 ring-white/10"
            />
            <button
              onClick={(e) => { e.stopPropagation(); downloadImage(lightboxImage); }}
              className="mt-6 bg-white text-black px-8 py-3 rounded-full font-bold font-display tracking-wide uppercase hover:bg-[var(--primary)] transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
              <Download size={20} /> Download Original
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <nav className="fixed top-0 w-full z-40 px-6 py-6 flex justify-between items-center bg-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center font-bold text-black shadow-[0_0_15px_var(--primary)]">
            CS
          </div>
          <span className="text-2xl font-display font-bold tracking-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">CaptureSync</span>
        </div>
        <div className="px-4 py-1.5 rounded-full glass-panel border border-[var(--glass-border)] text-xs font-mono text-[var(--primary)] flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === "System Ready" ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`}></div>
          {status || "SYSTEM ONLINE"}
        </div>
      </nav>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-10 md:py-20">

        {step === "LANDING" && (
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="glass-panel rounded-3xl p-6 md:p-8 relative overflow-hidden group hover:border-[var(--primary)] transition-colors duration-500">
              {/* Optional: Event Banner */}
              {eventData?.banner && (
                <div className="mb-8 w-full h-48 rounded-xl overflow-hidden relative shadow-2xl">
                  <img src={eventData.banner} alt="Event" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>
                  <div className="absolute bottom-4 left-4">
                    <p className="text-xs text-[var(--primary)] font-mono uppercase tracking-widest mb-1">Authenticated Access</p>
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-white leading-tight">{eventData.name}</h2>
                  </div>
                </div>
              )}

              {!eventData?.banner && (
                <div className="text-center mb-8 md:mb-12 relative">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-[var(--primary)] rounded-full blur-[80px] opacity-20 animate-pulse"></div>
                  <h1 className="relative text-4xl md:text-5xl font-display font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 leading-tight">
                    {eventData ? eventData.name : "Unlock Your\nMemories"}
                  </h1>
                  <p className="text-gray-400 font-mono text-xs md:text-sm">Instant AI-Powered Biometric Retrieval</p>
                </div>
              )}

              {/* Actions */}
              {!eventId ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                  <p className="text-red-400 font-mono text-sm mb-3">ACCESS DENIED: NO EVENT ID</p>
                  <a href="/admin" className="inline-block text-xs bg-red-600 px-6 py-2 rounded-full font-bold hover:bg-red-500 text-white transition-all shadow-[0_0_15px_rgba(220,38,38,0.5)]">ADMIN LOGIN</a>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Main Action Button */}
                  <button
                    onClick={() => setShowInputOptions(true)}
                    className="w-full group relative overflow-hidden bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] p-[1px] rounded-xl transition-all duration-300 hover:shadow-[0_0_30px_var(--primary)] hover:scale-[1.02] active:scale-95"
                  >
                    <div className="relative bg-black/80 backdrop-blur-md rounded-xl px-6 py-5 flex items-center justify-center gap-4 group-hover:bg-transparent transition-colors">
                      <FaceMatcherIcon className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                      <span className="font-bold font-display text-lg text-white tracking-wide">FIND MY PHOTOS</span>
                    </div>
                  </button>

                  {/* Secondary Gallery Link */}
                  <div className="text-center">
                    <button
                      onClick={fetchAllPhotos}
                      className="text-xs text-gray-500 hover:text-[var(--primary)] transition-colors font-mono uppercase tracking-widest border-b border-transparent hover:border-[var(--primary)] pb-1"
                    >
                      Click here to browse full event gallery
                    </button>
                  </div>

                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" ref={fileInputRef} />
                </div>
              )}
            </div>
            <p className="mt-8 text-center text-[10px] text-gray-600 font-mono tracking-[0.2em] uppercase opacity-50">
              Secured by CaptureSync Neural Network
            </p>
          </div>
        )}

        {/* Input Method Modal */}
        {showInputOptions && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Click outside to close */}
            <div className="absolute inset-0" onClick={() => setShowInputOptions(false)}></div>

            <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 relative z-10">
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6 sm:hidden"></div> {/* Mobile drag handle */}

              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white font-display">Select Source</h3>
                <button
                  onClick={() => setShowInputOptions(false)}
                  className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => { setShowInputOptions(false); startCamera(); }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-[var(--primary)]/20 border border-white/5 hover:border-[var(--primary)] transition-all group"
                >
                  <div className="p-3 rounded-full bg-white/10 group-hover:bg-[var(--primary)] text-white transition-colors">
                    <Camera size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white">Live Camera Scan</p>
                    <p className="text-xs text-gray-400 group-hover:text-[var(--primary)]/80">Take a selfie instantly</p>
                  </div>
                </button>

                <button
                  onClick={() => { setShowInputOptions(false); fileInputRef.current?.click(); }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-[var(--secondary)]/20 border border-white/5 hover:border-[var(--secondary)] transition-all group"
                >
                  <div className="p-3 rounded-full bg-white/10 group-hover:bg-[var(--secondary)] text-white transition-colors">
                    <Upload size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white">Upload from Device</p>
                    <p className="text-xs text-gray-400 group-hover:text-[var(--secondary)]/80">Choose from gallery</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "CAMERA" && (
          <div className="w-full max-w-md animate-in fade-in zoom-in duration-500 h-full flex flex-col justify-center">
            <div className="relative w-full aspect-[3/4] md:aspect-[3/4] lg:rounded-2xl bg-black rounded-lg overflow-hidden ring-1 ring-white/20 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />

              {/* HUD Overlay */}
              <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-16 h-16 border-t-2 border-l-2 border-[var(--primary)] rounded-tl-3xl opacity-80"></div>
                  <div className="w-16 h-16 border-t-2 border-r-2 border-[var(--primary)] rounded-tr-3xl opacity-80"></div>
                </div>
                <div className="flex justify-between">
                  <div className="w-16 h-16 border-b-2 border-l-2 border-[var(--primary)] rounded-bl-3xl opacity-80"></div>
                  <div className="w-16 h-16 border-b-2 border-r-2 border-[var(--primary)] rounded-br-3xl opacity-80"></div>
                </div>
                {/* Scanning Line */}
                <div className="animate-scan"></div>
              </div>

              {/* Controls */}
              <div className="absolute bottom-8 inset-x-0 flex justify-center items-center gap-8">
                <button
                  onClick={() => setStep("LANDING")}
                  className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 hover:scale-105 transition-all"
                >
                  <X size={24} />
                </button>
                <button
                  onClick={captureSelfie}
                  className="w-24 h-24 rounded-full border-4 border-white bg-[var(--primary)]/20 backdrop-blur-sm relative group active:scale-95 transition-all"
                >
                  <div className="absolute inset-2 rounded-full bg-white group-hover:scale-90 transition-transform duration-300"></div>
                </button>
                <div className="w-14"></div> {/* Spacer for balance */}
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>
        )}

        {(step === "RESULTS" || step === "ALL_PHOTOS") && (
          <div className="w-full max-w-7xl animate-in slide-in-from-bottom-10 duration-700">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 md:mb-12">
              <div>
                <button
                  onClick={() => setStep("LANDING")}
                  className="group flex items-center gap-2 text-gray-400 hover:text-[var(--primary)] transition-colors mb-4 text-xs font-mono uppercase tracking-widest"
                >
                  <X size={14} className="group-hover:rotate-90 transition-transform" /> TERMINATE SESSION
                </button>
                <h2 className="text-3xl md:text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-gray-500">
                  {step === "RESULTS" ? `Matches Found (${matches.length})` : "Global Gallery"}
                </h2>
              </div>
            </header>

            {(step === "RESULTS" ? matches : allPhotos).length === 0 ? (
              <div className="glass-panel rounded-3xl p-16 flex flex-col items-center justify-center text-center border-dashed border-2 border-white/10">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                  <Search size={32} className="text-gray-500" />
                </div>
                <p className="text-xl text-gray-300 font-display">No biometric matches located.</p>
                {step === "RESULTS" && <p className="text-sm text-gray-500 mt-2 max-w-md">The neural network could not identify a face. Please verify lighting conditions and try again.</p>}
              </div>
            ) : (
              <div className="columns-2 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                {(step === "RESULTS" ? matches : allPhotos.map(p => p.url)).map((src, i) => (
                  <div
                    key={i}
                    onClick={() => setLightboxImage(src)}
                    className="relative break-inside-avoid rounded-xl overflow-hidden group cursor-zoom-in border border-transparent hover:border-[var(--primary)] transition-all duration-300 shadow-xl bg-[#0a0a0a]"
                  >
                    <img src={src} alt="Event Photo" className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500" loading="lazy" />

                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--secondary)]/80 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-between p-4">
                      <span className="text-[10px] md:text-xs font-mono text-white/80 hidden md:block">IMG_{1000 + i}.JPG</span>
                      <button className="bg-white text-black p-2 md:p-3 rounded-full hover:scale-110 shadow-lg">
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}

// Helper for spinner
function FaceMatcherIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 7h6" /><path d="M12 7v10" />
    </svg>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <EventPage />
    </Suspense>
  );
}
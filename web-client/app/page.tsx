"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, Search, Download, X, Upload, Image as ImageIcon, ChevronRight, ScanFace, Lock, Aperture } from "lucide-react";
import * as faceapi from 'face-api.js';
import { FaceMatcher } from "@/lib/matcher";

type Step = "LANDING" | "CAMERA" | "RESULTS" | "ALL_PHOTOS";

interface Event {
  id: string;
  name: string;
  banner?: string;
}

function EventPage() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("LANDING");
  const [matches, setMatches] = useState<string[]>([]);
  const [allPhotos, setAllPhotos] = useState<{ id: string, url: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [showInputOptions, setShowInputOptions] = useState(false);
  const [eventData, setEventData] = useState<Event | null>(null);

  const eventId = searchParams.get("eventId");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Initialization
  useEffect(() => {
    setStatus("Initializing Neural Engine...");
    FaceMatcher.getInstance().loadModels().then(() => setStatus("System Ready"));

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
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Camera access denied or unavailable.");
      setStep("LANDING");
    }
  };

  const captureProcess = async (imageSource: string | HTMLVideoElement) => {
    if (!eventId) return;

    setLoading(true);
    setStatus("Encrypting Biometrics...");

    try {
      // 1. Detect Face
      let img;
      if (typeof imageSource === 'string') {
        img = await faceapi.fetchImage(imageSource);
      } else {
        // Video
        img = imageSource;
      }

      const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

      if (!detection) {
        alert("Verification Failed: No face detected. Please ensure good lighting.");
        setLoading(false);
        if (step === 'CAMERA') setStep("LANDING");
        return;
      }

      const vector = Array.from(detection.descriptor);

      // 2. Stop Camera if active
      if (videoRef.current && typeof imageSource !== 'string') {
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(t => t.stop());
      }

      // 3. Match
      setStatus("Matching Identity...");
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, vector })
      });

      const data = await res.json();
      if (data.matches && data.matches.length > 0) {
        setMatches(data.matches);
        setStep("RESULTS");
      } else {
        alert("No matches found in this event gallery.");
        setStep("LANDING");
      }

    } catch (e) {
      console.error(e);
      alert("System Error: " + e);
      setStep("LANDING");
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = () => {
    if (videoRef.current) captureProcess(videoRef.current);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) captureProcess(ev.target.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const fetchGlobalGallery = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/photos`);
      const data = await res.json();
      setAllPhotos(data);
      setStep("ALL_PHOTOS");
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // --- RENDER ---
  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans antialiased overflow-hidden selection:bg-indigo-500/30">

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-40 px-6 py-6 flex justify-between items-center mix-blend-difference text-white">
        <div className="font-bold text-xl tracking-tight flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center text-xs">C</div>
          CaptureSync
        </div>
        {!loading && step !== "LANDING" && (
          <button onClick={() => setStep("LANDING")} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        )}
      </nav>

      <main className="flex flex-col items-center justify-center min-h-screen px-4">

        {/* --- LANDING --- */}
        {step === "LANDING" && (
          <div className="w-full max-w-lg mx-auto text-center space-y-12 animate-fade-in relative z-10">

            {/* Event Badge */}
            {eventData && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-highlight)] border border-[var(--border)] animate-fade-in">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs font-mono uppercase tracking-widest text-[var(--muted)]">{eventData.name}</span>
              </div>
            )}

            {/* Hero Type */}
            <div className="space-y-6">
              <h1 className="text-5xl md:text-7xl font-display font-medium tracking-tight text-gradient">
                Unleash Your<br />Moments.
              </h1>
              <p className="text-[var(--muted)] text-lg max-w-sm mx-auto leading-relaxed">
                Secure, instant face authentication to retrieve your event memories.
              </p>
            </div>

            {/* Action */}
            <div className="space-y-4">
              {!eventId ? (
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-red-900/50 text-red-400 text-sm font-mono">
                  Access Denied: Missing Event Key
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setShowInputOptions(true)}
                    className="group relative w-full h-16 bg-white text-black rounded-full font-medium text-lg flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)]"
                  >
                    <ScanFace size={24} /> Start Identification
                  </button>
                  <button onClick={fetchGlobalGallery} className="text-sm text-[var(--muted)] hover:text-white transition-colors flex items-center justify-center gap-2 w-full py-2">
                    Browse Public Gallery <ChevronRight size={14} />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                </>
              )}
            </div>
          </div>
        )}

        {/* --- CAMERA SCANNING --- */}
        {step === "CAMERA" && (
          <div className="fixed inset-0 z-20 bg-black flex flex-col pt-24 pb-12 items-center justify-between">

            {/* Scan Frame */}
            <div className="relative w-full max-w-md aspect-[3/4] mx-auto px-6">
              <div className="relative w-full h-full rounded-[3rem] overflow-hidden border border-[var(--border)] shadow-2xl bg-zinc-900">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />

                {/* UI Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 pointer-events-none">
                  {/* Face Guide */}
                  <div className="w-64 h-80 rounded-[45%] border-2 border-white/20 relative overflow-hidden">
                    {/* Scan Line */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,1)] animate-scan"></div>
                  </div>
                  <p className="mt-8 text-white/50 font-mono text-xs uppercase tracking-widest bg-black/50 px-3 py-1 rounded backdrop-blur-md">Position Face within Frame</p>
                </div>
              </div>
            </div>

            {/* Control */}
            <button
              onClick={handleCapture}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center animate-pulse-ring active:scale-90 transition-transform"
            >
              <div className="w-16 h-16 rounded-full border-2 border-black"></div>
            </button>
          </div>
        )}

        {/* --- RESULTS GRID --- */}
        {(step === "RESULTS" || step === "ALL_PHOTOS") && (
          <div className="w-full max-w-7xl pt-24 pb-12 animate-fade-in px-4 md:px-0">
            <header className="mb-12 flex items-end justify-between border-b border-[var(--border)] pb-8">
              <div>
                <h2 className="text-4xl font-display font-medium text-white mb-2">
                  {step === "RESULTS" ? "Personal Gallery" : "Public Gallery"}
                </h2>
                <p className="text-[var(--muted)]">
                  {step === "RESULTS" ? `Found ${matches.length} matches verified by AI.` : "Browsing all event captures."}
                </p>
              </div>
            </header>

            <div className="columns-1 md:columns-3 lg:columns-4 gap-4 space-y-4">
              {(step === "RESULTS" ? matches : allPhotos.map(p => p.url)).map((src, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedPhoto(src)}
                  className="break-inside-avoid relative rounded-lg overflow-hidden group cursor-zoom-in bg-zinc-900"
                >
                  <img src={src} alt="" className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- LOADING OVERLAY --- */}
        {loading && (
          <div className="fixed inset-0 z-50 bg-[#09090b]/90 backdrop-blur-xl flex flex-col items-center justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border border-[var(--border)] animate-spin opacity-50"></div>
              <div className="absolute inset-0 w-24 h-24 rounded-full border-t border-white animate-spin"></div>
              <Lock className="absolute inset-0 m-auto text-white w-6 h-6" />
            </div>
            <p className="mt-8 text-sm font-mono uppercase tracking-widest text-[var(--muted)] animate-pulse">{status}</p>
          </div>
        )}

        {/* --- INPUT MODAL --- */}
        {showInputOptions && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in" onClick={() => setShowInputOptions(false)}>
            <div className="bg-[var(--surface)] border border-[var(--border)] w-full max-w-sm rounded-3xl p-6 animate-scale-in space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 bg-[var(--surface-highlight)] rounded-full mx-auto mb-6 sm:hidden"></div>

              <h3 className="text-center font-bold text-white mb-6">Verification Method</h3>

              <button onClick={() => { setShowInputOptions(false); startCamera() }} className="w-full p-4 rounded-xl bg-[var(--surface-highlight)] hover:bg-white hover:text-black transition-all flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center group-hover:bg-black/10"><Camera size={20} /></div>
                <div className="text-left"><p className="font-bold">Live Scan</p><p className="text-xs opacity-60">Instant verification</p></div>
              </button>

              <button onClick={() => { setShowInputOptions(false); fileInputRef.current?.click() }} className="w-full p-4 rounded-xl bg-[var(--surface-highlight)] hover:bg-white hover:text-black transition-all flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center group-hover:bg-black/10"><Upload size={20} /></div>
                <div className="text-left"><p className="font-bold">Upload Selfie</p><p className="text-xs opacity-60">From gallery</p></div>
              </button>
            </div>
          </div>
        )}

        {/* --- LIGHTBOX --- */}
        {selectedPhoto && (
          <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedPhoto(null)}>
            <img src={selectedPhoto} className="max-w-full max-h-[85vh] rounded shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
            <div className="absolute bottom-8 flex gap-4">
              <a href={selectedPhoto} download className="px-6 py-3 bg-white text-black rounded-full font-medium hover:scale-105 transition-transform flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <Download size={18} /> Download Original
              </a>
            </div>
            <button className="absolute top-6 right-6 p-4 text-white/50 hover:text-white transition-colors"><X size={24} /></button>
          </div>
        )}

      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white font-mono text-xs">LOADING ENTRY POINT...</div>}>
      <EventPage />
    </Suspense>
  );
}
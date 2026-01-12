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
      let img;
      if (typeof imageSource === 'string') {
        img = await faceapi.fetchImage(imageSource);
      } else {
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

      if (videoRef.current && typeof imageSource !== 'string') {
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(t => t.stop());
      }

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

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans antialiased overflow-hidden selection:bg-indigo-500/30">

      <nav className="fixed top-6 left-0 right-0 max-w-7xl mx-auto px-6 z-40 flex justify-between items-center mix-blend-difference text-white pointer-events-none">
        <div
          className="flex items-center gap-3 pointer-events-auto cursor-pointer group"
          onClick={() => {
            setStep("LANDING");
            setMatches([]);
            setSelectedPhoto(null);
          }}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-[0_0_20px_rgba(99,102,241,0.3)] group-hover:scale-105 transition-transform">
            <Aperture size={20} />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight group-hover:text-indigo-300 transition-colors">CaptureSync</h1>
            <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-widest hidden sm:block">AI Neural Gallery</p>
          </div>
        </div>

        {!loading && step !== "LANDING" && (
          <button onClick={() => setStep("LANDING")} className="pointer-events-auto w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all border border-white/10 hover:scale-110">
            <X size={20} />
          </button>
        )}
      </nav>

      <main className="relative flex flex-col items-center justify-center min-h-screen px-4 py-20">

        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px]"></div>
        </div>

        {step === "LANDING" && (
          <div className="w-full max-w-2xl mx-auto text-center space-y-16 animate-fade-in relative z-10">

            {eventId && eventData && (
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full glass-panel animate-fade-in hover:border-indigo-500/30 transition-colors cursor-default">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-mono uppercase tracking-widest text-[var(--foreground)]">{eventData.name}</span>
              </div>
            )}

            <div className="space-y-8">
              <h1 className="text-6xl md:text-8xl font-display font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 drop-shadow-sm">
                {eventId ? "Your Moments.\nInstantly." : "CaptureSync\nPro."}
              </h1>
              <p className="text-[var(--muted)] text-lg md:text-xl max-w-lg mx-auto leading-relaxed font-light">
                {eventId
                  ? "Advanced facial recognition to securely retrieve your event memories in milliseconds."
                  : "The premium AI-powered photo distribution platform for exclusive events."
                }
              </p>
            </div>

            <div className="w-full max-w-md mx-auto space-y-6">
              {!eventId ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => window.location.href = '/admin'}
                    className="group glass-panel p-8 rounded-2xl flex flex-col items-center justify-center gap-4 hover:-translate-y-1 transition-transform duration-300"
                  >
                    <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0)] group-hover:shadow-[0_0_20px_rgba(99,102,241,0.5)]">
                      <Lock size={24} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-white text-lg">Admin View</h3>
                      <p className="text-xs text-[var(--muted)] mt-1">Manage Galleries</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      const id = prompt("Please enter the Event ID provided by your host:");
                      if (id) window.location.href = `/?eventId=${id}`;
                    }}
                    className="group glass-panel p-8 rounded-2xl flex flex-col items-center justify-center gap-4 hover:-translate-y-1 transition-transform duration-300 text-left"
                  >
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0)] group-hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                      <ScanFace size={24} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-white text-lg">Guest Access</h3>
                      <p className="text-xs text-[var(--muted)] mt-1">Find Photos</p>
                    </div>
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setShowInputOptions(true)}
                    className="group relative w-full h-20 rounded-full overflow-hidden transition-all hover:scale-[1.02] shadow-[0_0_40px_rgba(99,102,241,0.2)] hover:shadow-[0_0_60px_rgba(99,102,241,0.4)]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600"></div>
                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay"></div>
                    <div className="relative flex items-center justify-center gap-4 text-white font-bold text-lg tracking-wide">
                      <ScanFace size={24} />
                      START IDENTIFICATION
                    </div>
                  </button>

                  <button onClick={fetchGlobalGallery} className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] hover:text-white transition-colors flex items-center justify-center gap-2 w-full py-4 opacity-70 hover:opacity-100">
                    Browse Public Gallery <ChevronRight size={12} />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                </>
              )}
            </div>
          </div>
        )}

        {step === "CAMERA" && (
          <div className="fixed inset-0 z-20 bg-black flex flex-col pt-24 pb-12 items-center justify-between">

            <div className="relative w-full max-w-md aspect-[3/4] mx-auto px-6">
              <div className="relative w-full h-full rounded-[3rem] overflow-hidden border border-[var(--border)] shadow-2xl bg-zinc-900">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />

                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 pointer-events-none">
                  <div className="w-64 h-80 rounded-[45%] border-2 border-white/20 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,1)] animate-scan"></div>
                  </div>
                  <p className="mt-8 text-white/50 font-mono text-xs uppercase tracking-widest bg-black/50 px-3 py-1 rounded backdrop-blur-md">Position Face within Frame</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleCapture}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center animate-pulse-ring active:scale-90 transition-transform"
            >
              <div className="w-16 h-16 rounded-full border-2 border-black"></div>
            </button>
          </div>
        )}

        {(step === "RESULTS" || step === "ALL_PHOTOS") && (
          <div className="w-full max-w-7xl pt-12 pb-24 animate-fade-in relative z-10">
            <header className="mb-12 flex items-end justify-between border-b border-white/10 pb-8 mx-6">
              <div>
                <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-2">
                  {step === "RESULTS" ? "Personal Gallery" : "Public Gallery"}
                </h2>
                <p className="text-[var(--muted)] font-light">
                  {step === "RESULTS" ? `Found ${matches.length} matches verified by AI.` : "Browsing all event captures."}
                  {step === "RESULTS" && matches.length === 0 && " No matches found."}
                </p>
              </div>
            </header>

            <div className="px-6 columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
              {(step === "RESULTS" ? matches : allPhotos.map(p => p.url)).map((src, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedPhoto(src)}
                  className="break-inside-avoid relative rounded-xl overflow-hidden group cursor-zoom-in bg-[var(--surface-highlight)] border border-white/5 hover:border-white/20 transition-all duration-500 hover:shadow-2xl"
                >
                  <img src={src} alt="" className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <p className="text-xs font-mono text-white/70 uppercase tracking-widest">View Full</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="fixed inset-0 z-50 bg-[#000000]/80 backdrop-blur-2xl flex flex-col items-center justify-center animate-fade-in">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-2 border-white/10 animate-spin"></div>
              <div className="absolute inset-0 w-24 h-24 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
              <Lock className="absolute inset-0 m-auto text-indigo-400 w-6 h-6 animate-pulse" />
            </div>
            <p className="mt-8 text-sm font-mono uppercase tracking-[0.2em] text-indigo-400 animate-pulse">{status}</p>
          </div>
        )}

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

        {selectedPhoto && (
          <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedPhoto(null)}>
            <img src={selectedPhoto} className="max-w-full max-h-[85vh] rounded shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
            <div className="absolute bottom-8 flex gap-4">
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const response = await fetch(selectedPhoto);
                    const blob = await response.blob();
                    const urlFilename = selectedPhoto.split('/').pop() || 'photo.jpg';
                    const filename = urlFilename.includes('.') ? urlFilename : `${urlFilename}.jpg`;

                    const link = document.createElement('a');
                    link.href = window.URL.createObjectURL(blob);
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(link.href);
                  } catch (err) {
                    window.open(selectedPhoto, '_blank');
                  }
                }}
                className="px-6 py-3 bg-white text-black rounded-full font-medium hover:scale-105 transition-transform flex items-center gap-2"
              >
                <Download size={18} /> Download Original
              </button>
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
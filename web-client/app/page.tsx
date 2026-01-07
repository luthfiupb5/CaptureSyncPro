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

function EventPage() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("LANDING");
  const [selfie, setSelfie] = useState<string | null>(null);
  const [matches, setMatches] = useState<string[]>([]);
  const [allPhotos, setAllPhotos] = useState<{ id: string, url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // Event State
  const [eventData, setEventData] = useState<Event | null>(null);
  const eventId = searchParams.get("eventId");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 1. Initial Load: Models
    setStatus("Loading AI models...");
    FaceMatcher.getInstance().loadModels().then(() => setStatus("Ready"));

    // 2. Fetch Event Data
    if (eventId) {
      fetch('/api/events') // In a real app, /api/events/{id}
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
    setStatus("Analyzing face...");
    try {
      // 1. Get Vector (Client Side)
      const img = await faceapi.fetchImage(selfieUrl);
      const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

      if (!detection) {
        alert("No face detected in selfie!");
        setStep("LANDING");
        setLoading(false);
        return;
      }

      const vector = Array.from(detection.descriptor);

      // 2. Search API
      setStatus("Searching database...");
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
      // Fallback
      window.open(url, '_blank');
    }
  };

  return (
    <main className="relative min-h-screen bg-black overflow-hidden selection:bg-purple-500 selection:text-white font-sans">

      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:rotate-90"
          >
            <X size={24} />
          </button>

          <div className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center group">
            <img
              src={lightboxImage}
              alt="Full View"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
            />

            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadImage(lightboxImage);
              }}
              className="mt-8 bg-white text-black px-8 py-3 rounded-full font-bold text-lg hover:bg-gray-200 hover:scale-105 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
              <Download size={20} /> Download Photo
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <nav className="fixed top-0 w-full z-40 px-6 py-4 flex justify-between items-center bg-transparent backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">
            E
          </div>
          <span className="text-xl font-bold tracking-tight text-white">CaptureSync Pro</span>
        </div>
        <div className="px-3 py-1 rounded-full bg-white/10 border border-white/5 text-xs font-medium text-gray-300 backdrop-blur-md">
          {status || "Online"}
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-20">

        {step === "LANDING" && (
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-5 duration-700">
            {/* Event Card */}
            <div className="bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 overflow-hidden relative shadow-2xl">
              {/* Glow Effect */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-blue-500/20 to-transparent blur-2xl pointer-events-none"></div>

              {eventData?.banner && (
                <div className="mb-8 w-full h-48 rounded-2xl overflow-hidden shadow-lg relative group">
                  <img src={eventData.banner} alt="Event Banner" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent"></div>
                  <div className="absolute bottom-4 left-4">
                    <p className="text-xs text-blue-300 font-medium uppercase tracking-wider mb-1">Welcome to</p>
                    <h2 className="text-2xl font-bold text-white shadow-black drop-shadow-lg leading-tight">{eventData.name}</h2>
                  </div>
                </div>
              )}

              {!eventData?.banner && (
                <div className="text-center mb-10">
                  <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-400">
                    {eventData ? eventData.name : "Find Your Photos"}
                  </h1>
                  <p className="text-gray-400 text-sm">Use AI face recognition to find your photos instantly.</p>
                </div>
              )}

              {!eventId ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                  <p className="text-red-400 text-sm mb-3">No Event Selected</p>
                  <a href="/admin" className="inline-block text-xs bg-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-500 text-white transition-colors">Go to Admin</a>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={startCamera}
                    className="group w-full relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 p-[1px] rounded-2xl hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-300 active:scale-95"
                  >
                    <div className="relative bg-gray-900/50 hover:bg-transparent transition-colors rounded-2xl px-6 py-4 flex items-center justify-center gap-3">
                      <Camera className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                      <span className="font-bold text-lg text-white">Take Selfie</span>
                    </div>
                  </button>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    ref={fileInputRef}
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 group active:scale-95"
                  >
                    <Upload className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                    <span>Upload Image</span>
                  </button>

                  <button
                    onClick={fetchAllPhotos}
                    className="w-full bg-transparent hover:bg-white/5 text-gray-400 hover:text-white px-6 py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Image className="w-4 h-4" />
                    <span>View full gallery</span>
                  </button>
                </div>
              )}
            </div>

            <p className="mt-8 text-center text-xs text-gray-500">
              Powered by <span className="text-gray-400 font-semibold">CaptureSync AI</span> • Privacy Focused
            </p>
          </div>
        )}

        {step === "CAMERA" && (
          <div className="w-full max-w-md animate-in fade-in zoom-in duration-300">
            <div className="relative aspect-[3/4] bg-black rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10">
              {!loading ? (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />

                  {/* Camera Overlay */}
                  <div className="absolute inset-0 pointer-events-none border-[20px] border-black/30"></div>

                  <div className="absolute bottom-0 inset-x-0 p-8 flex justify-center items-center bg-gradient-to-t from-black/80 to-transparent">
                    <button
                      onClick={captureSelfie}
                      className="w-20 h-20 rounded-full border-4 border-white bg-white/20 backdrop-blur-sm hover:scale-110 hover:bg-white/40 transition-all active:scale-95 shadow-lg"
                    />
                  </div>

                  <button
                    onClick={() => setStep("LANDING")}
                    className="absolute top-6 right-6 p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 bg-gray-900">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FaceMatcherIcon className="animate-pulse text-blue-500" />
                    </div>
                  </div>
                  <p className="text-gray-400 font-medium tracking-wide animate-pulse">{status}</p>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>
        )}

        {(step === "RESULTS" || step === "ALL_PHOTOS") && (
          <div className="w-full max-w-6xl animate-in slide-in-from-bottom-10 duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <button
                  onClick={() => setStep("LANDING")}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-2 text-sm font-medium"
                >
                  <X size={16} /> Close Gallery
                </button>
                <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
                  {step === "RESULTS" ? "Your Matches" : "Event Gallery"}
                </h2>
              </div>
            </header>

            {(step === "RESULTS" ? matches : allPhotos).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-40 bg-gray-900/30 rounded-3xl border border-white/5">
                <Search size={48} className="text-gray-700 mb-4" />
                <p className="text-xl text-gray-500 font-medium">No photos found.</p>
                {step === "RESULTS" && <p className="text-sm text-gray-600 mt-2">Try taking another selfie with better lighting.</p>}
              </div>
            ) : (
              <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                {(step === "RESULTS" ? matches : allPhotos.map(p => p.url)).map((src, i) => (
                  <div
                    key={i}
                    onClick={() => setLightboxImage(src)}
                    className="relative break-inside-avoid rounded-xl overflow-hidden group cursor-zoom-in"
                  >
                    <img src={src} alt="" className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadImage(src);
                        }}
                        className="bg-white/90 backdrop-blur text-black p-3 rounded-full hover:scale-110 hover:bg-white transition-all shadow-lg"
                      >
                        <Download size={20} />
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
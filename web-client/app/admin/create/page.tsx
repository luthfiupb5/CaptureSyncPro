"use client";

import { useState, useEffect } from "react";
import * as faceapi from 'face-api.js';
import { FaceMatcher } from "@/lib/matcher";
import { Upload, Download, Loader2, CheckCircle, FileJson } from "lucide-react";

export default function CreateEventPage() {
    const [images, setImages] = useState<File[]>([]);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [indexData, setIndexData] = useState<any[] | null>(null);
    const [modelStatus, setModelStatus] = useState("Loading models...");

    useEffect(() => {
        FaceMatcher.getInstance().loadModels().then(() => setModelStatus("Models Ready"));
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setImages(Array.from(e.target.files));
            setIndexData(null);
        }
    };

    const processImages = async () => {
        if (images.length === 0) return;
        setProcessing(true);
        setProgress({ current: 0, total: images.length });

        const newIndex = [];

        for (let i = 0; i < images.length; i++) {
            const file = images[i];
            try {
                const imgUrl = URL.createObjectURL(file);
                const img = await faceapi.fetchImage(imgUrl);

                const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();

                const vectors = detections.map(d => Array.from(d.descriptor));

                if (vectors.length > 0) {
                    newIndex.push({
                        image: file.name,
                        vectors: vectors
                    });
                }

                URL.revokeObjectURL(imgUrl);
            } catch (e) {
                console.error(`Error processing ${file.name}`, e);
            }

            setProgress(prev => ({ ...prev, current: i + 1 }));
        }

        setIndexData(newIndex);
        setProcessing(false);
    };

    const downloadIndex = () => {
        if (!indexData) return;
        const jsonString = JSON.stringify(indexData);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "index.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <main className="min-h-screen bg-black text-white p-6 font-sans">
            <div className="max-w-3xl mx-auto">
                <header className="mb-10 border-b border-white/10 pb-6">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Loader2 className="text-purple-500 animate-spin-slow" />
                        Indexer Studio
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Process event photos entirely in your browser. No installation needed.
                    </p>
                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-bold">
                        {modelStatus}
                    </p>
                </header>

                <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
                    <div className="p-8 border-b border-white/5">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                            Select Photos
                        </h2>
                        <div className="relative border-2 border-dashed border-gray-700 rounded-lg p-10 hover:bg-white/5 transition-colors text-center cursor-pointer group">
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                            <Upload className="mx-auto text-gray-500 mb-4 group-hover:text-white transition-colors" size={40} />
                            <p className="text-lg font-medium">Drop photos here or click to browse</p>
                            <p className="text-sm text-gray-500 mt-2">{images.length > 0 ? `${images.length} photos selected` : "Supports JPG, PNG"}</p>
                        </div>
                    </div>

                    <div className={`p-8 border-b border-white/5 ${images.length === 0 ? 'opacity-30 pointer-events-none' : ''}`}>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                            Process Faces
                        </h2>

                        {!processing && !indexData && (
                            <button
                                onClick={processImages}
                                className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors flex items-center gap-2"
                            >
                                <Loader2 className="animate-spin" size={20} />
                                Start Indexing
                            </button>
                        )}

                        {processing && (
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span>Processing...</span>
                                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                                </div>
                                <div className="h-4 bg-black rounded-full overflow-hidden border border-white/10">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-500">{progress.current} / {progress.total} photos analyzed</p>
                            </div>
                        )}

                        {indexData && (
                            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg flex items-center gap-3 text-green-400">
                                <CheckCircle size={24} />
                                <div>
                                    <p className="font-bold">Indexing Complete!</p>
                                    <p className="text-sm">Found faces in {indexData.length} photos.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={`p-8 ${!indexData ? 'opacity-30 pointer-events-none' : ''}`}>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
                            Download & Deploy
                        </h2>

                        <div className="flex gap-4">
                            <button
                                onClick={downloadIndex}
                                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-500 transition-colors flex items-center gap-2"
                            >
                                <FileJson size={20} />
                                Download index.json
                            </button>

                            <a
                                href="/admin"
                                target="_blank"
                                className="bg-gray-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-700 transition-colors flex items-center gap-2"
                            >
                                Go to Event Setup
                            </a>
                        </div>

                        <div className="mt-6 p-4 bg-black/50 rounded-lg text-sm text-gray-400 space-y-2">
                            <p className="font-bold text-gray-300">Next Steps:</p>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>Upload your photos to a folder (Google Drive, Dropbox, etc).</li>
                                <li>Upload this <code>index.json</code> to the same folder.</li>
                                <li>Get a direct link to the <code>index.json</code>.</li>
                                <li>Use that link in the Admin Setup page.</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

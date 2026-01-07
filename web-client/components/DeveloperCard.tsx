
"use client";

import { useState } from "react";
import { Github, Linkedin, Code, X, Phone } from "lucide-react";

export default function DeveloperCard() {
    const [isOpen, setIsOpen] = useState(true);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 left-4 z-50 p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-white/20 transition-all shadow-lg animate-fade-in"
                title="Meet the Developer"
            >
                <Code size={20} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 left-4 z-50 animate-slide-in-up">
            <div className="bg-gray-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl w-72 relative overflow-hidden group">
                {/* Close Button */}
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors"
                >
                    <X size={14} />
                </button>

                <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 shadow-lg">
                        <img
                            src="/assets/Founder_dp.jpg"
                            alt="Luthfi Bassam"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white leading-tight">Luthfi Bassam U P</h3>
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 font-mono mt-0.5">
                            <Phone size={10} /> +91 7356556087
                        </div>
                    </div>
                </div>

                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                    Built with Next.js, Face-API.js & Passion.
                </p>

                <div className="flex gap-2">
                    <a
                        href="https://github.com/luthfiupb5"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-lg py-1.5 flex items-center justify-center gap-2 text-xs text-gray-300 transition-all font-medium"
                    >
                        <Github size={12} /> GitHub
                    </a>
                    <a
                        href="https://www.linkedin.com/in/luthfibassamup/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/20 hover:border-blue-500/50 rounded-lg py-1.5 flex items-center justify-center gap-2 text-xs text-blue-400 transition-all font-medium"
                    >
                        <Linkedin size={12} /> Connect
                    </a>
                </div>

                {/* Decorative Glow */}
                <div className="absolute -top-10 -left-10 w-20 h-20 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-10 -right-10 w-20 h-20 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
            </div>
        </div>
    );
}

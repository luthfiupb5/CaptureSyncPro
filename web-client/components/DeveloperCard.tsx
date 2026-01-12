
"use client";

import { useState } from "react";
import { Github, Linkedin, Code, X, Phone, Mail } from "lucide-react";

export default function DeveloperCard() {
    const [isOpen, setIsOpen] = useState(true);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-[100] p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-white hover:bg-white/10 hover:scale-110 transition-all shadow-[0_0_20px_rgba(255,255,255,0.05)] animate-fade-in group"
                title="Meet the Developer"
            >
                <Code size={24} className="group-hover:text-indigo-400 transition-colors" />
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-[100] animate-slide-in-up">
            <div className="glass-panel p-5 rounded-2xl w-80 relative overflow-hidden group border-white/10 shadow-2xl shadow-black/50">
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1 rounded-full"
                >
                    <X size={14} />
                </button>

                <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/10 shadow-lg ring-2 ring-transparent group-hover:ring-indigo-500/30 transition-all cursor-pointer hover:scale-105">
                        <img
                            src="/assets/Founder_dp.jpg"
                            alt="Luthfi Bassam"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-0.5">Meet the Developer</p>
                        <h3 className="text-lg font-display font-bold text-white leading-tight">Luthfi Bassam U P</h3>
                        <div className="flex flex-col gap-1 mt-2">
                            <div className="flex items-center gap-2 text-[11px] text-[var(--muted)] font-mono">
                                <Phone size={12} className="text-white/40" /> +91 7356556087
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-[var(--muted)] font-mono">
                                <Mail size={12} className="text-white/40" /> connect.luthfi05@gmail.com
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">


                    <div className="flex gap-3 pt-1">
                        <a
                            href="https://github.com/luthfiupb5"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 bg-white/5 hover:bg-black/40 border border-white/5 hover:border-white/20 rounded-xl py-2 flex items-center justify-center gap-2 text-xs text-white/80 hover:text-white transition-all font-medium group/btn"
                        >
                            <Github size={14} className="group-hover/btn:scale-110 transition-transform" /> GitHub
                        </a>
                        <a
                            href="https://www.linkedin.com/in/luthfibassamup/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 hover:from-blue-600/30 hover:to-indigo-600/30 border border-blue-500/20 hover:border-blue-500/40 rounded-xl py-2 flex items-center justify-center gap-2 text-xs text-blue-200 hover:text-white transition-all font-medium group/btn"
                        >
                            <Linkedin size={14} className="group-hover/btn:scale-110 transition-transform" /> Connect
                        </a>
                    </div>
                </div>

                <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-colors duration-500" />
                <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-violet-500/20 transition-colors duration-500" />
            </div>
        </div>
    );
}

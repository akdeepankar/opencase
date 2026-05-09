"use client";

import { useState } from "react";
import { DEMO_TOPIC, PHOTOSYNTHESIS_TOPIC } from "../demoData";

const TOPICS = [
  { label: "Murder Mystery", icon: "🕵️‍♂️" },
  { label: "Cyber Espionage", icon: "💻" },
  { label: "Digital Forensics", icon: "🧬" },
  { label: "Cold Cases", icon: "❄️" },
  { label: "Heist Analysis", icon: "💎" },
  { label: "Serial Profiling", icon: "👤" },
  { label: "Cartel Activity", icon: "📦" },
  { label: "Corporate Espionage", icon: "🏢" },
];

interface LandingScreenProps {
  onStart: (topic: string) => void;
}

export default function LandingScreen({ onStart }: LandingScreenProps) {
  const [topic, setTopic] = useState("");
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) onStart(topic.trim());
  };

  return (
    <div className="landing-root relative flex flex-col items-center justify-center p-4 sm:p-10 min-h-screen">
      {/* Background Image Layer */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-1000"
        style={{ 
          backgroundImage: "url('/opencase.jpg')",
        }}
      />
      {/* Dark Overlay with Leather-like Grain */}
      <div className="absolute inset-0 z-1 bg-black/60 backdrop-blur-[2px] texture-leather opacity-80" />
      
      {/* Dossier Container */}
      <div className="w-full max-w-5xl texture-paper min-h-[70vh] relative shadow-2xl overflow-hidden flex flex-col rounded-sm z-10">
        <div className="paperclip" />
        <div className="coffee-stain bottom-[-40px] right-[-40px] scale-150" />
        
        {/* Dossier Header/Tab */}
        <div className="absolute top-0 left-0 px-8 py-2 bg-amber-900/10 border-b border-r border-amber-900/10 rounded-br-xl">
          <span className="text-[10px] font-mono text-amber-900/40 uppercase tracking-[0.4em] font-bold">EDUCATIONAL DOSSIER // TOP SECRET</span>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row relative z-10">
          
          {/* Left: Branding & Info */}
          <div className="flex-1 p-10 lg:p-16 border-r border-amber-900/5">
            <div className="flex items-center gap-4 mb-16">
              <div className="w-12 h-12 rounded-lg bg-amber-950 flex items-center justify-center shadow-lg">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f5deb3" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-amber-950 font-serif">OpenCase</h1>
            </div>

            <div className="max-w-md">
              <div className="ink-stamp mb-8">FOR FIELD AGENTS ONLY</div>
              <h2 className="text-5xl lg:text-6xl font-black text-amber-950 tracking-tighter leading-[1.1] mb-8 font-serif">
                Crack the Code <br />
                <span className="text-amber-700 italic underline decoration-amber-500/20">of Mastery.</span>
              </h2>
              <p className="text-lg text-amber-900/60 font-serif leading-relaxed mb-12">
                Transform any subject into a high-stakes forensic investigation. Uncover AI clues, piece together evidence, and solve the case.
              </p>

              {/* Feature Pills */}
              <div className="flex flex-wrap gap-4 opacity-40 mb-8">
                <div className="px-4 py-2 bg-amber-900/5 rounded border border-amber-900/10 text-[10px] font-mono font-bold text-amber-900 uppercase">Interactive Evidence</div>
                <div className="px-4 py-2 bg-amber-900/5 rounded border border-amber-900/10 text-[10px] font-mono font-bold text-amber-900 uppercase">Adaptive AI Logic</div>
              </div>

              {/* Powered by Runway (Active Glow) */}
              <a 
                href="https://runwayml.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="relative group mt-4 inline-block cursor-pointer"
              >
                <div className="absolute inset-0 bg-amber-900/10 blur-xl rounded-full animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
                <img 
                  src="https://runway-static-assets.s3.amazonaws.com/site/images/api-page/powered-by-runway-black.svg" 
                  alt="Powered by Runway" 
                  className="h-7 opacity-80 group-hover:opacity-100 transition-all duration-500 drop-shadow-[0_0_10px_rgba(69,26,3,0.2)]"
                />
              </a>
            </div>
          </div>

          {/* Right: Interaction */}
          <div className="lg:w-[420px] bg-amber-50/30 p-10 lg:p-16 flex flex-col justify-center">
            
            <div className="mb-10">
              <p className="text-[10px] text-amber-800/40 font-mono uppercase tracking-[0.2em] mb-2 font-bold">New Mission Parameters</p>
              <h3 className="text-xl font-bold text-amber-950 mb-6">Specify Topic</h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className={`relative transition-all duration-300 ${focused ? "scale-[1.02]" : ""}`}>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="e.g. Thermodynamics"
                    className="w-full bg-white border-2 border-amber-900/10 rounded-sm p-4 text-amber-950 placeholder:text-amber-900/20 outline-none focus:border-amber-700 transition-all font-medium shadow-inner"
                  />
                  <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-20">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={!topic.trim()}
                  className="w-full py-4 bg-amber-950 text-amber-50 rounded-sm font-black text-sm uppercase tracking-[0.3em] hover:bg-black transition-all shadow-xl disabled:opacity-30 flex items-center justify-center gap-3"
                >
                  Start Investigation
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                </button>
              </form>
            </div>

            <div className="space-y-6">
              <p className="text-[10px] text-amber-800/40 font-mono uppercase tracking-[0.2em] font-bold">Quick Access Dossiers</p>
              
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => onStart(DEMO_TOPIC)}
                  className="flex items-center justify-between p-3 px-4 bg-white border border-amber-900/5 hover:border-amber-700/30 rounded-sm transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🕵️‍♂️</span>
                    <span className="text-sm font-bold text-amber-900">{DEMO_TOPIC.replace("🕵️‍♂️ ", "")}</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-600 font-bold opacity-0 group-hover:opacity-100 uppercase tracking-widest transition-opacity">Ready</span>
                </button>

                <button
                  onClick={() => onStart(PHOTOSYNTHESIS_TOPIC)}
                  className="flex items-center justify-between p-3 px-4 bg-white border border-amber-900/5 hover:border-amber-700/30 rounded-sm transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🌿</span>
                    <span className="text-sm font-bold text-amber-900">{PHOTOSYNTHESIS_TOPIC.replace("🌿 ", "")}</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-600 font-bold opacity-0 group-hover:opacity-100 uppercase tracking-widest transition-opacity">Ready</span>
                </button>

                {TOPICS.slice(0, 2).map((t) => (
                  <button
                    key={t.label}
                    onClick={() => onStart(t.label)}
                    className="flex items-center justify-between p-3 px-4 bg-white/50 border border-amber-900/5 hover:bg-white hover:border-amber-700/30 rounded-sm transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{t.icon}</span>
                      <span className="text-sm font-medium text-amber-900/70">{t.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto pt-10">
              <div className="flex items-center gap-2 opacity-20">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-900" />
                <span className="text-[9px] font-mono font-bold text-amber-900 uppercase tracking-widest">v1.2 // SECURE_ENCRYPTION_ACTIVE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-8 text-[10px] text-amber-50/20 font-mono uppercase tracking-[0.5em] text-center">
        OpenCase Investigative Engine // Finalizing Mission Parameters
      </p>
    </div>
  );
}


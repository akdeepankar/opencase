"use client";

import { useEffect, useRef } from "react";

interface CinematicScreenProps {
  onComplete: () => void;
}

export default function CinematicScreen({ onComplete }: CinematicScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Attempt to autoplay
    if (videoRef.current) {
      videoRef.current.play().catch(err => {
        console.warn("Autoplay blocked, waiting for interaction", err);
      });
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">
      {/* Cinematic Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-t from-amber-950/20 to-transparent pointer-events-none" />
      
      <video
        ref={videoRef}
        src="/opencase.mp4"
        className="w-full h-full object-cover shadow-2xl"
        onEnded={onComplete}
        autoPlay
        playsInline
      />

      {/* Overlay Branding */}
      <div className="absolute top-12 left-12 pointer-events-none z-20 anim-fadeIn">
        <div className="flex items-center gap-8 opacity-60">
           <div className="w-12 h-12 rounded-sm bg-white/10 flex items-center justify-center border border-white/10 shadow-2xl">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
           </div>
           <div className="flex flex-col">
              <span className="text-4xl font-black text-white uppercase tracking-[0.2em] font-serif leading-none">OpenCase</span>
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.8em] mt-2 font-bold">Secure Archival Feed // LIVE</span>
           </div>
        </div>
      </div>

      {/* Skip Control */}
      <button 
        onClick={onComplete}
        className="absolute bottom-10 right-10 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-mono text-white/40 uppercase tracking-[0.4em] transition-all group z-20"
      >
        <span className="group-hover:text-white transition-colors">Skip Sequence</span>
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import loadingData from "../../public/loading.json";

interface LoadingScreenProps {
  topic: string;
}

const PHASES = [
  { msg: "Opening case files…", icon: "📁" },
  { msg: "Briefing your detective…", icon: "🕵️" },
  { msg: "Sealing investigation dossier…", icon: "📋" },
];

export default function LoadingScreen({ topic }: LoadingScreenProps) {
  const [phase, setPhase] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((p) => (p + 1) % PHASES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 relative z-10">
      <div className="orb orb-1" />
      <div className="orb orb-3" />

      <div className="relative z-10 text-center flex flex-col items-center">
        {/* Lottie Loader */}
        <div className="w-64 h-64 mb-4 anim-fadeIn">
          <Lottie 
            animationData={loadingData} 
            loop={true} 
            className="w-full h-full"
          />
        </div>

        {/* Topic badge */}
        <div className="mb-8 anim-fadeInUp d-100">
          <span className="badge badge-purple uppercase tracking-widest text-[10px] font-mono">
            Assignment // {topic}
          </span>
        </div>

        <p className="text-xl text-zinc-400 font-serif italic anim-fadeIn h-8" key={`msg-${phase}`}>
          {PHASES[phase].msg}
        </p>

        <p className="text-[10px] font-mono text-zinc-600 mt-12 uppercase tracking-[0.6em]">
          Initializing Secure Archival Engine{dots}
        </p>
      </div>
    </div>
  );
}

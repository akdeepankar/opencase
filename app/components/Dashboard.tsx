"use client";
import { useState } from "react";
import { Case, DetectiveCharacter } from "../types";

interface DashboardProps {
  topic: string;
  investigationTitle: string;
  character: DetectiveCharacter;
  cases: Case[];
  onSelectCase: (index: number) => void;
}

function getDifficultyLevel(d: string): number {
  const m: Record<string, number> = {
    "Basic Observation": 1, "Missing Element": 2, "Comparison": 3,
    "Multi-step Reasoning": 4, "Full System Understanding": 5,
  };
  return m[d] || 1;
}

export default function Dashboard({ topic, investigationTitle, character, cases, onSelectCase }: DashboardProps) {
  const [openCaseId, setOpenCaseId] = useState<number | null>(null);
  const completedCount = cases.filter((c) => c.status === "completed").length;
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(completedCount > 0);
  const progress = (completedCount / cases.length) * 100;

  return (
    <div className="dash-root bg-[#1a1b1e] texture-leather min-h-screen p-6 sm:p-12 overflow-y-auto">

      {/* Evidence Board Container */}
      <div className="max-w-7xl mx-auto">

        {/* Folder Stack Area (Master Portfolio) */}
        <div
          onClick={() => !isPortfolioOpen && setIsPortfolioOpen(true)}
          className={`texture-cork rounded-xl border-[12px] border-amber-900/20 shadow-2xl relative transition-all duration-1000 ease-in-out h-[650px] ${isPortfolioOpen ? "p-10 lg:p-16" : "p-0 cursor-pointer hover:scale-[1.01]"}`}
        >
          {/* CLOSED PORTFOLIO COVER */}
          {!isPortfolioOpen && (
            <div className="absolute inset-0 z-50 texture-leather rounded-lg flex flex-col items-center justify-center anim-fadeIn overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-30" />

              {/* Latches */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 w-12 h-20 bg-amber-900/40 border-r-4 border-amber-900/20 rounded-r-lg flex items-center justify-center">
                <div className="w-4 h-10 bg-amber-950 rounded-sm shadow-inner" />
              </div>
              <div className="absolute top-1/2 -translate-y-1/2 right-0 w-12 h-20 bg-amber-900/40 border-l-4 border-amber-900/20 rounded-l-lg flex items-center justify-center">
                <div className="w-4 h-10 bg-amber-950 rounded-sm shadow-inner" />
              </div>

              {/* Branding Center */}
              <div className="relative z-10 flex flex-col items-center mb-12">
                <div className="w-20 h-20 rounded-full border-4 border-double border-white/10 flex items-center justify-center mb-6">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="0.5" className="opacity-20"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                <h2 className="text-3xl font-black text-white/40 uppercase tracking-[0.4em] font-serif">OpenCase</h2>
                <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.8em] mt-3 font-bold">Investigation // Archival Portfolio</p>
              </div>

              {/* Massive Title (Center) */}
              <div className="relative z-10 w-full max-w-4xl px-20 text-center space-y-4">
                <span className="text-[10px] font-mono text-white/20 uppercase tracking-[1em] font-black">Active Assignment</span>
                <h1 className="text-4xl md:text-5xl font-black text-white/60 font-serif uppercase tracking-tight leading-none drop-shadow-2xl">
                  {investigationTitle}
                </h1>
                <div className="pt-8 flex flex-col items-center gap-6">
                  <div className="flex items-center justify-center gap-4">
                    <div className="h-[1px] w-12 bg-white/10" />
                    <span className="text-[10px] font-mono text-white/10 uppercase tracking-[0.5em]">Classified Document</span>
                    <div className="h-[1px] w-12 bg-white/10" />
                  </div>
                  
                  {/* Integrated Runway Seal (Glow) */}
                  <a 
                    href="https://runwayml.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="relative group mt-2 cursor-pointer pointer-events-auto"
                  >
                    <div className="absolute inset-0 bg-white/20 blur-xl rounded-full animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
                    <img 
                      src="https://runway-static-assets.s3.amazonaws.com/site/images/api-page/powered-by-runway-white.svg" 
                      alt="Powered by Runway" 
                      className="h-7 opacity-40 group-hover:opacity-100 transition-all duration-500 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                    />
                  </a>
                </div>
              </div>

              <div className="absolute bottom-12 flex items-center gap-2 animate-pulse">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                <span className="text-[10px] font-mono text-amber-500/40 uppercase tracking-widest">Click to Access Secure Archives</span>
              </div>
            </div>
          )}

          {isPortfolioOpen && (
            <div className="anim-fadeIn h-full flex flex-col">
              {/* Case Dossiers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 lg:gap-12 flex-1">
                {cases.map((c, i) => {
                  const isOpen = openCaseId === c.case_id;
                  return (
                    <div
                      key={c.case_id}
                      onClick={() => {
                        if (c.status === "locked") return;
                        if (isOpen) {
                          onSelectCase(i);
                        } else {
                          setOpenCaseId(c.case_id);
                        }
                      }}
                      className={`group relative transition-all duration-700 cursor-pointer ${c.status === "locked" ? "grayscale opacity-50 pointer-events-none" : isOpen ? "scale-105 z-50" : "hover:-translate-y-2"}`}
                    >
                      {/* Background Cards (Packet Effect) */}
                      <div className={`absolute inset-0 bg-[#e5e0d5] shadow-lg rounded-sm transition-all duration-500 ${isOpen ? "translate-x-4 -translate-y-6 -rotate-6" : "translate-x-2 translate-y-2 rotate-2"}`} />
                      <div className={`absolute inset-0 bg-[#f4f1e9] shadow-lg rounded-sm transition-all duration-500 ${isOpen ? "-translate-x-4 -translate-y-4 rotate-6" : "translate-x-1 translate-y-1 rotate-1"}`} />

                      {/* Physical Folder Look */}
                      <div className={`w-full aspect-[4/5] relative texture-paper p-8 flex flex-col shadow-xl transition-all duration-500 ${c.status === "completed" ? "border-l-8 border-emerald-500/40" : "border-l-8 border-amber-500/40"} ${isOpen ? "scale-y-105 shadow-2xl" : ""}`}>
                        <div className="paperclip" />

                        {/* CLOSED STATE COVER */}
                        {!isOpen ? (
                          <div className="flex-1 flex flex-col items-center justify-center space-y-6 anim-fadeIn">
                            <div className="w-20 h-20 bg-amber-950/5 rounded-full border-4 border-double border-amber-950/10 flex items-center justify-center">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(69,26,3,0.2)" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                            </div>
                            <div className="text-center relative">
                              {c.status === "completed" && (
                                <div className="ink-stamp !text-[10px] !text-emerald-600 !border-emerald-600 !rotate-[-5deg] absolute -top-8 left-1/2 -translate-x-1/2 w-full">SOLVED</div>
                              )}
                              <p className="text-[10px] font-mono font-black text-amber-900/30 uppercase tracking-[0.4em] mb-1">Dossier ID</p>
                              <h4 className="text-2xl font-black text-amber-950 font-serif">#{String(c.case_id).padStart(3, "0")}</h4>
                            </div>
                            <div className="ink-stamp !text-[12px] !border-4 !text-red-900/30 !border-red-900/30 !rotate-[-12deg]">TOP SECRET</div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col anim-fadeIn">
                            <div className="mb-6 flex justify-between items-start">
                              <span className="text-[10px] font-mono text-amber-800/30 uppercase tracking-widest font-black">UNSEALED // ID #{String(c.case_id).padStart(3, "0")}</span>
                              <div className="ink-stamp !text-[8px] !rotate-0 !border-2 !text-red-600/60 !border-red-600/60 !py-1">ACTIVE</div>
                            </div>

                            <h3 className={`text-2xl font-black leading-tight mb-4 font-serif ${c.status === "locked" ? "text-amber-950/20" : "text-amber-950"}`}>
                              {c.status === "locked" ? "CLASSIFIED" : c.title}
                            </h3>

                            {c.status !== "locked" ? (
                              <p className="text-sm text-amber-900/50 font-serif italic line-clamp-6 leading-relaxed mb-8">
                                {c.scenario}
                              </p>
                            ) : (
                              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-amber-800/10 rounded-sm">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(120,90,60,0.2)" strokeWidth="2">
                                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                              </div>
                            )}

                            <div className="mt-auto flex flex-col gap-6">
                              <div className="flex items-center justify-between">
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5].map((d) => (
                                    <div key={d} className="w-1.5 h-1.5 rounded-full" style={{
                                      background: d <= getDifficultyLevel(c.difficulty) ? "#b8860b" : "rgba(120,90,60,0.1)"
                                    }} />
                                  ))}
                                </div>
                                {c.status === "completed" && (
                                  <div className="ink-stamp !text-[8px] !rotate-0 !border-2 !text-emerald-600/40 !border-emerald-600/40">SOLVED</div>
                                )}
                              </div>

                              <button className="w-full py-3 bg-amber-950 text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-sm hover:bg-amber-900 transition-colors shadow-lg">
                                Launch Investigation
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Folder Tab Effect */}
                      <div className={`absolute -top-6 left-8 px-4 py-1.5 bg-amber-950/10 border-t border-x border-amber-950/10 rounded-t-lg text-[9px] font-mono text-amber-950/40 font-bold uppercase tracking-widest transition-opacity duration-300 ${isOpen ? "opacity-0" : "opacity-100"}`}>
                        Level {getDifficultyLevel(c.difficulty)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Master Dossier Cloth Wrap (Only when open) */}
          {isPortfolioOpen && (
            <div className="absolute bottom-0 left-0 right-0 h-1/2 texture-leather border-t-[8px] border-amber-900/40 pointer-events-none z-10 opacity-90 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] anim-fadeIn flex flex-col justify-end p-10">
              <div className="grid grid-cols-2 gap-16 items-end relative z-20">
                {/* Internal Mission Details */}
                <div className="space-y-6 pointer-events-auto">
                  <div className="flex items-center gap-6">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono text-white/20 uppercase tracking-[0.6em]">Archival Record // {topic.toUpperCase()}</span>
                      <h1 className="text-4xl font-black text-white/60 font-serif uppercase tracking-tight leading-none">{investigationTitle}</h1>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsPortfolioOpen(false); }}
                      className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all border border-white/5 text-white/30"
                      title="Secure Portfolio"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m18 15-6-6-6 6" /></svg>
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest font-black">Sync Completion</span>
                      <span className="text-lg font-black text-white/50 font-serif">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div className="h-full bg-white/20 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>

                {/* Internal Detective ID */}
                <div className="flex items-center gap-6 border-l-2 border-white/5 pl-10 h-24">
                  <div className="w-16 h-16 rounded bg-white/5 flex items-center justify-center text-3xl shadow-inner grayscale opacity-40">🕵️</div>
                  <div>
                    <p className="font-black text-xl text-white/50 font-serif leading-none uppercase tracking-widest">{character.name}</p>
                    <p className="text-[9px] text-white/10 font-mono uppercase tracking-[0.4em] mt-2">Lead Investigator</p>
                  </div>
                </div>
              </div>

              {/* OPENCASE Branding Stamp */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-8deg] opacity-[0.06] select-none z-0">
                <div className="border-[6px] border-red-500/80 px-10 py-4 rounded-sm">
                  <span className="text-6xl font-black text-red-500/80 tracking-[0.2em] uppercase font-serif">OPENCASE</span>
                </div>
              </div>
            </div>
          )}

          <div className="absolute bottom-10 right-10 opacity-10">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="0.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          </div>
        </div>

      </div>
    </div>

  );
}


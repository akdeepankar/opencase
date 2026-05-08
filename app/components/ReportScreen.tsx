"use client";
import { useEffect, useState, useRef } from "react";
import { Case, CaseAnswer, DetectiveCharacter } from "../types";
import { toPng } from "html-to-image";

interface Props {
  topic: string; investigationTitle: string; character: DetectiveCharacter; cases: Case[]; answers: CaseAnswer[]; onRestart: () => void;
}

function getVerdict(s: number) {
  if (s >= 85) return { label: "LEAD INVESTIGATOR", cls: "!text-emerald-700 !border-emerald-700", stamp: "EXCEPTIONAL" };
  if (s >= 60) return { label: "FIELD AGENT", cls: "!text-blue-700 !border-blue-700", stamp: "VERIFIED" };
  return { label: "RECRUIT", cls: "!text-amber-800 !border-amber-800", stamp: "PROVISIONAL" };
}

export default function ReportScreen({ topic, investigationTitle, character, cases, answers, onRestart }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const raw = answers.reduce((t, a) => t + Math.max(0, 20 - (a.attempts - 1) * 5), 0);
  const score = Math.min(100, Math.max(0, raw));
  const verdict = getVerdict(score);
  const perfectCount = answers.filter(a => a.attempts === 1).length;
  const totalAttempts = answers.reduce((s, a) => s + a.attempts, 0);

  useEffect(() => {
    let c = 0; const step = score / 45;
    const iv = setInterval(() => { c += step; if (c >= score) { setDisplayScore(score); clearInterval(iv); } else setDisplayScore(Math.round(c)); }, 25);
    return () => clearInterval(iv);
  }, [score]);

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(reportRef.current, {
        cacheBust: true,
        backgroundColor: "#fcfaf7",
        filter: (node) => {
          const exclusionClasses = ['hide-on-export'];
          return !exclusionClasses.some(cls => (node as HTMLElement).classList?.contains(cls));
        },
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      const link = document.createElement('a');
      link.download = `OpenCase_Disposition_${investigationTitle.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-y-auto p-6 sm:p-12 bg-[#0a0a0b]">
      {/* Immersive Background (opencase.jpg) */}
      <div className="fixed inset-0 z-0">
        <img 
          src="/opencase.jpg" 
          alt="Background" 
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-[#0a0a0b]/40 backdrop-blur-[4px]" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* FINAL DISPOSITION REPORT (FLAT PAPER) */}
        <div ref={reportRef} className="bg-[#fcfaf7] p-12 pb-24 relative shadow-2xl anim-fadeInUp overflow-hidden border border-white/10">
          <div className="paperclip opacity-20" />
          <div className="coffee-stain top-[-40px] right-[-40px] opacity-10" />
          
          {/* Header Section */}
          <div className="flex justify-between items-start mb-12 border-b-2 border-amber-800/10 pb-8">
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-amber-800/40 uppercase tracking-[0.4em] font-black">Official Disposition Report</p>
              <h1 className="text-4xl font-black text-amber-950 font-serif uppercase tracking-tight">{investigationTitle}</h1>
              <p className="text-xs font-mono text-amber-900/60 uppercase tracking-widest mt-2">Subject: {topic}</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="ink-stamp !text-[12px] !border-4 !text-red-900/30 !border-red-900/30 !rotate-[-10deg]">CLASSIFIED</div>
              <div className="text-right">
                <p className="text-[9px] font-mono text-amber-800/30 uppercase tracking-widest">Bureau Record ID: OC-{Math.floor(Math.random() * 90000 + 10000)}</p>
                <p className="text-[10px] font-mono text-amber-950/60 font-black tracking-[0.2em] mt-0.5">OPENCASE.INFO</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-16">
            
            <div className="space-y-12">
              {/* Summary Section */}
              <section>
                <h3 className="text-xs font-black text-amber-950 uppercase tracking-[0.3em] mb-4 border-l-4 border-amber-950 pl-4">Executive Summary</h3>
                <p className="text-lg text-amber-900/80 font-serif leading-relaxed italic">
                  The investigation titled <span className="font-bold text-amber-950 underline decoration-amber-900/20 underline-offset-4">&quot;{investigationTitle}&quot;</span> has reached its formal conclusion. 
                  Based on the empirical evidence analyzed across {cases.length} forensic vectors, the detective has demonstrated a core mastery of <span className="text-amber-950 font-black">{topic}</span>. All results have been logged and verified by the central archival engine.
                </p>
              </section>

              {/* Case Breakdown */}
              <section>
                <h3 className="text-xs font-black text-amber-950 uppercase tracking-[0.3em] mb-6 border-l-4 border-amber-950 pl-4">Evidence Processing Log</h3>
                <div className="space-y-4">
                  {cases.map((c, i) => {
                    const a = answers.find(ans => ans.caseId === c.case_id);
                    return (
                      <div key={c.case_id} className="flex items-center gap-6 p-4 border border-amber-800/5 bg-amber-800/[0.02] rounded-sm group">
                        <span className="text-[10px] font-mono text-amber-800/30 font-black">VEC_{i+1}</span>
                        <div className="flex-1">
                          <p className="text-sm font-black text-amber-950 font-serif uppercase tracking-tight">{c.title}</p>
                          <p className="text-[10px] text-amber-800/40 font-mono uppercase tracking-widest">{c.difficulty}</p>
                        </div>
                        {a && (
                          <div className={`ink-stamp !text-[8px] !rotate-0 !py-1 !px-3 ${a.attempts === 1 ? "!text-emerald-700 !border-emerald-700" : "!text-amber-800 !border-amber-800"}`}>
                            {a.attempts === 1 ? "PERFECT" : `${a.attempts} ATTEMPTS`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Official Authentication & Validation Block */}
              <section className="pt-12 border-t-2 border-amber-950/5 mt-12">
                <div className="flex flex-col md:flex-row justify-between items-end gap-12">
                  {/* Investigator Side */}
                  <div className="space-y-3">
                    <p className="text-[8px] font-mono text-amber-800/40 uppercase tracking-[0.4em] font-black">Investigator Authentication</p>
                    <div className="signature-font text-3xl text-amber-950/70 pb-1 border-b border-amber-950/10 px-2 min-w-[180px]">
                      {character.name}
                    </div>
                    <p className="text-[9px] font-mono text-amber-800/30 uppercase tracking-tighter">ID: 772-DELTA-{character.name.split(' ')[0].toUpperCase()}</p>
                  </div>

                  {/* Bureau Side */}
                  <div className="text-right space-y-3">
                    <p className="text-[8px] font-mono text-amber-800/40 uppercase tracking-[0.4em] font-black">Archive Validation</p>
                    <p className="text-xs font-black text-amber-900 font-serif uppercase tracking-tight">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p className="text-[9px] font-mono text-amber-800/30 uppercase tracking-widest font-black">Bureau Record Log #OC-V42</p>
                  </div>
                </div>
              </section>
            </div>

            {/* Score & Verdict Sidebar */}
            <div className="space-y-12 flex flex-col items-center border-l border-amber-950/5 pl-8">
              {/* Score Gauge */}
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg width="150" height="150" viewBox="0 0 200 200" className="rotate-[-90deg]">
                  <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(69,26,3,0.05)" strokeWidth="15" />
                  <circle 
                    cx="100" cy="100" r="85" fill="none" stroke="rgba(69,26,3,0.3)" strokeWidth="15" 
                    strokeDasharray="534" 
                    strokeDashoffset={534 - (displayScore / 100) * 534}
                    className="transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-amber-950 font-serif leading-none">{displayScore}</span>
                  <span className="text-[8px] font-mono text-amber-800/40 uppercase tracking-[0.2em] mt-1">Accuracy %</span>
                </div>
              </div>

              {/* Large Verdict Stamp */}
              <div className="text-center space-y-4">
                <div className="ink-stamp !text-lg !border-[4px] !px-6 !py-3 !rotate-[-12deg] bg-white/5 shadow-md mx-auto d-500 anim-fadeInScale">
                  {verdict.stamp}
                </div>
                <div className="pt-4">
                  <p className="text-[8px] font-mono text-amber-800/40 uppercase tracking-[0.4em] mb-1">Rank Attained</p>
                  <p className={`text-base font-black font-serif tracking-tighter ${verdict.cls}`}>{verdict.label}</p>
                </div>
              </div>

              {/* Stats Block */}
              <div className="w-full space-y-4 pt-8">
                <div className="flex justify-between items-center py-2 border-b border-amber-800/5">
                  <span className="text-[8px] font-mono text-amber-800/40 uppercase tracking-widest">Perfect Solves</span>
                  <span className="text-xs font-black text-amber-950">{perfectCount}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-amber-800/5">
                  <span className="text-[8px] font-mono text-amber-800/40 uppercase tracking-widest">Intel Points</span>
                  <span className="text-xs font-black text-amber-950">{score * 125}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-amber-800/5">
                  <span className="text-[8px] font-mono text-amber-800/40 uppercase tracking-widest">Iterations</span>
                  <span className="text-xs font-black text-amber-950">{totalAttempts}</span>
                </div>
              </div>

              {/* Powered By Runway (Prominent Sidebar Position) */}
              <div className="flex flex-col items-center gap-3 pt-12 mt-auto w-full border-t border-amber-950/5">
                <span className="text-[8px] font-mono uppercase tracking-[0.5em] text-amber-950/40 font-bold">System Powered By</span>
                <img 
                  src="https://runway-static-assets.s3.amazonaws.com/site/images/api-page/powered-by-runway-white.svg" 
                  alt="Runway" 
                  className="h-10 invert opacity-90 transition-all hover:opacity-100"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Floating Action Hub (Compact) */}
        <div className="fixed bottom-12 right-12 z-[100] flex flex-col gap-2.5 w-52 hide-on-export">
          <button 
            onClick={handleDownload}
            disabled={isExporting}
            className="w-full py-3 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-[0.3em] rounded-lg hover:bg-emerald-500 transition-all hover:scale-[1.05] active:scale-95 shadow-xl flex items-center justify-center gap-2.5 border border-emerald-500/20 backdrop-blur-md"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            {isExporting ? "Processing..." : "Export Evidence"}
          </button>
          <button 
            onClick={onRestart}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-[0.3em] rounded-lg transition-all border border-white/5 backdrop-blur-xl shadow-lg flex items-center justify-center gap-2.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
            New Mission
          </button>
        </div>
      </div>
    </div>
  );
}

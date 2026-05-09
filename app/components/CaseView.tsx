import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import { Case, DetectiveCharacter, LabCombination } from "../types";
import { AvatarCall } from '@runwayml/avatars-react';
import '@runwayml/avatars-react/styles.css';

// Dynamic import for ForensicLab to avoid SSR issues with Konva
const ForensicLab = dynamic(() => import("./ForensicLab"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-amber-900/5 animate-pulse rounded-xl" />
});

interface CaseViewProps {
  caseData: Case; caseIndex: number; totalCases: number;
  character: DetectiveCharacter; topic: string;
  onSolved: (feedback: string, attempts: number) => void; onBack: () => void;
}

function Typewriter({ text, speed = 18 }: { text: string; speed?: number }) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setShown(""); setDone(false); let i = 0;
    const iv = setInterval(() => {
      if (i < text.length) { setShown(text.slice(0, ++i)); } else { setDone(true); clearInterval(iv); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return (
    <span className="text-slate-200">{shown}{!done && <span className="inline-block w-0.5 h-4 bg-amber-400/80 ml-0.5 align-text-bottom" style={{ animation: "typewriterBlink 0.8s infinite" }} />}</span>
  );
}

/* ═══════════ EVIDENCE MODAL ═══════════ */
function EvidenceModal({ evidence, caseId, onClose }: { evidence: Case["evidence"]; caseId: number; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6" style={{ zIndex: 99999 }}>
      <div className="absolute inset-0 bg-[#0a0e1a]/90 backdrop-blur-md" onClick={onClose} />
      <div className="case-panel relative w-full max-w-3xl max-h-[85vh] overflow-y-auto anim-fadeInScale">
        {/* Header bar */}
        <div className="case-panel-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="case-badge-gold">FILE #{String(caseId).padStart(3, "0")}</span>
            <span className={`case-badge ${evidence.type === "video" ? "case-badge-red" : "case-badge-blue"}`}>
              {evidence.type === "video" ? "▶ VIDEO" : "◻ PHOTO"}
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded bg-amber-800/5 hover:bg-amber-800/10 border border-amber-800/10 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m18 6-12 12" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>
        {/* Body */}
        <div className="p-8">
          <h3 className="text-2xl font-black text-amber-950 tracking-tight mb-2">Evidence Analysis</h3>
          <p className="text-xs text-amber-800/40 font-mono uppercase tracking-widest mb-8">Classification: Restricted Access</p>

          <div className="case-evidence-frame p-4 mb-8 flex items-center justify-center bg-black/5 overflow-hidden">
            {evidence.url ? (
              evidence.type === 'video' ? (
                <video src={evidence.url} className="max-w-full max-h-[400px] object-contain shadow-2xl" controls autoPlay loop />
              ) : (
                <img src={evidence.url} alt="Evidence" className="max-w-full max-h-[400px] object-contain shadow-2xl" />
              )
            ) : (
              <p className="text-[16px] text-amber-900 leading-[1.9] font-medium p-4">{evidence.description}</p>
            )}
          </div>

          {evidence.url && (
            <div className="case-evidence-frame p-8 mb-8">
              <p className="text-[16px] text-amber-900 leading-[1.9] font-medium">{evidence.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="case-info-block">
              <p className="case-info-label">Hidden Clue</p>
              <p className="text-sm text-amber-900/70 leading-relaxed">{evidence.hidden_clue}</p>
            </div>
            <div className="case-info-block">
              <p className="case-info-label">Reconstruction</p>
              <p className="text-sm text-amber-800/50 leading-relaxed italic">&quot;{evidence.generation_prompt}&quot;</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ MAIN ═══════════ */
export default function CaseView({ caseData, caseIndex, totalCases, character, topic, onSolved, onBack }: CaseViewProps) {
  const [answer, setAnswer] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [isEval, setIsEval] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [activeTab, setActiveTab] = useState<"mission" | "evidence" | "forensic" | "pc">("mission");
  const [zoomedItem, setZoomedItem] = useState<string | null>(null);
  const [pcFolderOpen, setPcFolderOpen] = useState<"videos" | "audio" | null>(null);
  const [pcSelectedFile, setPcSelectedFile] = useState<{ name: string; type: 'video' | 'audio' } | null>(null);
  const [pcLocked, setPcLocked] = useState(true);
  const [pcPasswordInput, setPcPasswordInput] = useState("");
  const [pcError, setPcError] = useState(false);
  const [shuffleCount, setShuffleCount] = useState(0);
  const [isBoardLightOn, setIsBoardLightOn] = useState(true);

  // Evidence Generation State
  const [evidenceRevealed, setEvidenceRevealed] = useState(false);
  const [evidenceGenerating, setEvidenceGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [genProgress, setGenProgress] = useState("");

  const handleGenerateEvidence = useCallback(async () => {
    setEvidenceGenerating(true);
    setGenProgress("Initializing RunwayML...");
    try {
      const prompts = [
        { id: "fieldA", prompt: caseData.evidence.generation_prompt, ratio: "960:720" },
        { id: "map", prompt: `A professional cartographic street map based on the specific locations mentioned in this case: "${caseData.title}". Style: clean, modern navigation map (like Google Maps or Apple Maps), including street names, building outlines, and subtle investigative markers or 'hints' such as highlighted areas or suspect waypoints. Minimalistic and realistic.`, ratio: "1280:720" },
        { id: "fieldC", prompt: `Close-up forensic detail photograph related to: ${caseData.evidence.generation_prompt}. Macro lens, evidence markers, dramatic lighting, portrait orientation`, ratio: "720:960" },
      ];
      setGenProgress("Generating evidence images via RunwayML...");
      const res = await fetch("/api/generate-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts }),
      });
      if (!res.ok) throw new Error("Failed to generate evidence");
      const data = await res.json();
      const imageMap: Record<string, string> = {};
      for (const item of data.items) {
        if (item.url) imageMap[item.id] = item.url;
      }
      setGeneratedImages(imageMap);
      setGenProgress("Evidence materialized.");
      setTimeout(() => {
        setEvidenceRevealed(true);
        setEvidenceGenerating(false);
        setIsBoardLightOn(false);
      }, 600);
    } catch (err) {
      console.error("Evidence generation failed:", err);
      setGenProgress("Generation failed. Revealing board...");
      setTimeout(() => {
        setEvidenceRevealed(true);
        setEvidenceGenerating(false);
      }, 1200);
    }
  }, [caseData]);

  const handleRetryImage = async (id: string) => {
    if (retryingIds.has(id)) return;
    setRetryingIds(prev => new Set(prev).add(id));
    
    try {
      let prompt = "";
      let ratio = "1280:720";
      if (id === "fieldA") { prompt = caseData.evidence.generation_prompt; ratio = "960:720"; }
      if (id === "fieldC") { prompt = `Close-up forensic detail photograph related to: ${caseData.evidence.generation_prompt}. Macro lens, evidence markers, dramatic lighting, portrait orientation`; ratio = "720:960"; }
      if (id === "map") prompt = `A professional cartographic street map based on the specific locations mentioned in this case: "${caseData.title}". Style: clean, modern navigation map (like Google Maps or Apple Maps), including street names, building outlines, and subtle investigative markers or 'hints' such as highlighted areas or suspect waypoints. Minimalistic and realistic.`;

      const res = await fetch("/api/generate-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts: [{ id, prompt, ratio }] }),
      });
      
      const data = await res.json();
      const result = data.items.find((item: any) => item.id === id);
      if (result?.url) {
        setGeneratedImages(prev => ({ ...prev, [id]: result.url }));
      }
    } catch (err) {
      console.error("Retry failed:", err);
    } finally {
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Forensic Tab State
  const [nodes, setNodes] = useState<{ id: number; x: number; y: number; text: string; type?: 'text' | 'image'; labId?: string }[]>([]);
  const [edges, setEdges] = useState<{ from: number; to: number }[]>([]);
  const [dragNode, setDragNode] = useState<number | null>(null);

  // Permanent lab items that should always be present
  const labItems = useMemo(() => {
    const baseItems = caseData.lab_items && caseData.lab_items.length > 0
      ? caseData.lab_items
      : [
        { id: "sample_a", label: "Sample A", icon: "🧬", type: "text" as const },
        { id: "sample_b", label: "Sample B", icon: "🧪", type: "text" as const },
        { id: "record", label: "Case Record", icon: "📋", type: "text" as const },
      ];

    // Always ensure Visual Scan is present with id "visual"
    const hasVisual = baseItems.some(item => item.id === "visual");
    if (!hasVisual) {
      return [...baseItems, { id: "visual", label: "Visual Scan", icon: "📸", type: "image" as const }];
    }
    return baseItems;
  }, [caseData.lab_items]);

  // Lab combination state
  const [labComboResults, setLabComboResults] = useState<Record<string, { imageUrl?: string; clue: string; loading?: boolean }>>({});
  const [nodeComboMap, setNodeComboMap] = useState<Record<number, string>>({}); // nodeId -> comboKey
  const [runningNodeIds, setRunningNodeIds] = useState<number[]>([]);
  const [zoomedLabComboKey, setZoomedLabComboKey] = useState<string | null>(null);

  // Terminal Interface State
  const [terminalInterfaceStarted, setTerminalInterfaceStarted] = useState(false);
  const [terminalGenerating, setTerminalGenerating] = useState(false);
  const [terminalVideoUrl, setTerminalVideoUrl] = useState<string | null>(null);
  const [terminalAudioUrl, setTerminalAudioUrl] = useState<string | null>(null);
  const [terminalAudioPlaying, setTerminalAudioPlaying] = useState(false);
  const terminalAudioRef = useRef<HTMLAudioElement | null>(null);

  // Avatar State
  const [avatarData, setAvatarData] = useState<any>(null);
  const [avatarSession, setAvatarSession] = useState<any>(null);
  const [avatarCreating, setAvatarCreating] = useState(false);
  const [creationStage, setCreationStage] = useState<string>("");
  const [isCallOpen, setIsCallOpen] = useState(false);

  const handleCreateAvatar = async () => {
    if (avatarCreating) return;
    setAvatarCreating(true);
    setCreationStage("Making a Connection...");
    try {
      const res = await fetch("/api/create-avatar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: character.name,
          personality: character.personality,
          gender: character.gender,
          topic: topic,
          caseTitle: caseData.title,
          scenario: caseData.scenario,
          hint: caseData.hint,
          fullCaseData: caseData // Pass entire case structure for knowledge base
        })
      });

      setCreationStage("Materializing Agent...");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP error! status: ${res.status}`);
      }
      if (data.avatar) {
        setAvatarData(data.avatar);
      }
    } catch (err) {
      console.error("Avatar creation failed:", err);
    } finally {
      setAvatarCreating(false);
      setCreationStage("");
    }
  };

  const [sessionStarting, setSessionStarting] = useState(false);
  const handleStartSession = async () => {
    if (sessionStarting || avatarSession?.sessionId) return;
    setSessionStarting(true);
    try {
      const res = await fetch("/api/start-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId: avatarData.id,
          isPreset: false
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP error! status: ${res.status}`);
      }
      if (data.sessionId) {
        setAvatarSession(data);
      }
    } catch (err) {
      console.error("Session start failed:", err);
      const errorMsg = err instanceof Error ? err.message : "";

      if (errorMsg.includes("429") || errorMsg.includes("limit has been reached")) {
        alert("⚠️ NEURAL BANDWIDTH EXHAUSTED: Your daily Runway API task limit has been reached. Please try again in 24 hours.");
      } else if (errorMsg.includes("Avatar processing failed")) {
        setAvatarData(null);
        alert("Forensic materialization failed. Please re-initialize the neural link.");
      } else {
        alert("Neural uplink failed. Please check connection and retry.");
      }
    } finally {
      setSessionStarting(false);
    }
  };

  const addNode = () => {
    const id = Date.now();
    setNodes([...nodes, { id, x: 100 + Math.random() * 400, y: 100 + Math.random() * 200, text: "New Clue" }]);
  };

  const findCombo = useCallback((id1: string, id2: string): LabCombination | undefined => {
    return caseData.lab_combinations?.find(c =>
      (c.items[0] === id1 && c.items[1] === id2) || (c.items[0] === id2 && c.items[1] === id1)
    );
  }, [caseData.lab_combinations]);

  const triggerComboGen = useCallback(async (comboKey: string, combo: LabCombination) => {
    setLabComboResults(prev => ({ ...prev, [comboKey]: { clue: combo.clue, loading: true } }));
    try {
      const res = await fetch("/api/generate-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts: [{ id: comboKey, prompt: combo.prompt, ratio: "1280:720" }] }),
      });
      if (res.ok) {
        const data = await res.json();
        const url = data.items?.[0]?.url;
        setLabComboResults(prev => ({ ...prev, [comboKey]: { clue: combo.clue, imageUrl: url || undefined, loading: false } }));
      } else {
        setLabComboResults(prev => ({ ...prev, [comboKey]: { clue: combo.clue, loading: false } }));
      }
    } catch {
      setLabComboResults(prev => ({ ...prev, [comboKey]: { clue: combo.clue, loading: false } }));
    }
  }, []);

  const toggleEdge = useCallback((fromId: number, toId: number) => {
    if (fromId === toId) return;
    setEdges(prev => {
      const existing = prev.find(e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId));
      if (existing) return prev.filter(e => e !== existing);
      const newEdges = [...prev, { from: fromId, to: toId }];
      // Check for lab combination
      const fromNode = nodes.find(n => n.id === fromId);
      const toNode = nodes.find(n => n.id === toId);
      if (fromNode?.labId && toNode?.labId) {
        const combo = findCombo(fromNode.labId, toNode.labId);
        if (combo) {
          const comboKey = [fromNode.labId, toNode.labId].sort().join("_");
          if (!labComboResults[comboKey]) {
            triggerComboGen(comboKey, combo);
          }
        }
      }
      return newEdges;
    });
  }, [nodes, findCombo, labComboResults, triggerComboGen]);

  const handleRunAnalysis = useCallback((nodeId: number) => {
    const targetNode = nodes.find(n => n.id === nodeId);
    if (!targetNode) return;

    // Find all nodes connected to this image node
    const connectedEdges = edges.filter(e => e.from === nodeId || e.to === nodeId);
    const connectedNodes = connectedEdges
      .map(e => {
        const otherId = e.from === nodeId ? e.to : e.from;
        return nodes.find(n => n.id === otherId);
      })
      .filter((n): n is NonNullable<typeof n> => !!n && !!n.labId);

    // Pool of IDs to check for combos: the neighbors + the clicked node itself
    const pool = connectedNodes.map(n => n.labId!);
    if (targetNode.labId && targetNode.labId !== "__output__") {
      pool.push(targetNode.labId);
    }

    if (pool.length < 2) return;

    // Generate combos for all pairs in the pool
    let triggeredAny = false;
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const combo = findCombo(pool[i], pool[j]);
        if (combo) {
          const comboKey = [pool[i], pool[j]].sort().join("_");
          setNodeComboMap(prev => ({ ...prev, [nodeId]: comboKey }));
          if (!labComboResults[comboKey]) {
            triggerComboGen(comboKey, combo);
          }
          triggeredAny = true;
        }
      }
    }

    if (triggeredAny) {
      setRunningNodeIds(prev => [...prev, nodeId]);
    }
  }, [edges, nodes, findCombo, labComboResults, triggerComboGen]);

  // Effect to clear running status when results finish
  useEffect(() => {
    setRunningNodeIds(prev => {
      const stillRunning = prev.filter(id => {
        const comboKey = nodeComboMap[id];
        return comboKey && labComboResults[comboKey]?.loading;
      });
      if (stillRunning.length !== prev.length) return stillRunning;
      return prev;
    });
  }, [labComboResults, nodeComboMap]);

  const handlePcLogin = () => {
    if (pcPasswordInput === caseData.terminal_code) {
      setPcLocked(false);
      setPcError(false);
    } else {
      setPcError(true);
      setPcPasswordInput("");
      setTimeout(() => setPcError(false), 2000);
    }
  };

  const handleStartTerminalInterface = async () => {
    if (terminalGenerating) return;
    setTerminalGenerating(true);
    setTerminalInterfaceStarted(true);

    try {
      const [videoRes, audioRes] = await Promise.all([
        fetch("/api/generate-evidence", {
          method: "POST",
          body: JSON.stringify({
            type: 'video',
            prompts: [{
              id: 'terminal_video',
              prompt: `Authentic CCTV security footage, grainy high-angle surveillance camera view, monochrome or desaturated colors, date-time stamp overlay in corner, digital noise, flickering, static, showing: ${caseData.terminal_video_prompt || "security sweep"}. Highly realistic forensic aesthetic.`
            }]
          })
        }),
        fetch("/api/generate-evidence", {
          method: "POST",
          body: JSON.stringify({
            type: 'speech',
            prompts: [{ id: 'terminal_audio', prompt: caseData.terminal_audio_text || "The analysis is complete." }]
          })
        })
      ]);

      const videoData = await videoRes.json();
      const audioData = await audioRes.json();

      if (videoData.items?.[0]?.url) setTerminalVideoUrl(videoData.items[0].url);
      if (audioData.items?.[0]?.url) setTerminalAudioUrl(audioData.items[0].url);
    } catch (err) {
      console.error("Terminal generation failed:", err);
    } finally {
      setTerminalGenerating(false);
    }
  };

  useEffect(() => {
    setPcLocked(true);
    setPcPasswordInput("");
    setPcError(false);
    setActiveTab("mission");
    setAnswer("");
    setFeedback(null);
    setAttempts(0);
    setZoomedItem(null);
    setNodes([{ id: 1, x: 700, y: 300, text: "Visual Output", type: "image", labId: "__output__" }]);
    setEdges([]);
    setPcFolderOpen(null);
    setPcSelectedFile(null);
    setShuffleCount(0);
    setEvidenceRevealed(false);
    setEvidenceGenerating(false);
    setGeneratedImages({});
    setGenProgress("");
    setLabComboResults({});
    setTerminalInterfaceStarted(false);
    setTerminalVideoUrl(null);
    setTerminalAudioUrl(null);
    setRunningNodeIds([]);
    setNodeComboMap({});
    setAvatarData(null);
    setAvatarSession(null);
    setAvatarCreating(false);
    setIsCallOpen(false);
  }, [caseIndex]);

  // Dynamic Card Shuffling Logic
  const boardLayout = useMemo(() => {
    const hashString = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash);
    };

    const seed = hashString(String(caseData.case_id || "0")) + caseIndex + shuffleCount;
    const getRandom = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    return {
      letter: {
        top: `${5 + getRandom(seed) * 5}%`,
        left: `${25 + getRandom(seed + 1) * 15}%`,
        rotate: `${(getRandom(seed + 2) - 0.5) * 6}deg`
      },
      news: {
        top: `${25 + getRandom(seed + 3) * 10}%`,
        left: `${5 + getRandom(seed + 4) * 10}%`,
        rotate: `${(getRandom(seed + 5) - 0.5) * 4}deg`
      },
      map: {
        top: `${50 + getRandom(seed + 6) * 8}%`,
        left: `${5 + getRandom(seed + 7) * 20}%`,
        rotate: `${(getRandom(seed + 8) - 0.5) * 3}deg`
      },
      fieldA: {
        top: `${4 + getRandom(seed + 9) * 6}%`,
        left: `${55 + getRandom(seed + 10) * 10}%`,
        rotate: `${(getRandom(seed + 11) - 0.5) * 8}deg`
      },
      fieldC: {
        top: `${2 + getRandom(seed + 12) * 8}%`,
        left: `${82 + getRandom(seed + 13) * 6}%`,
        rotate: `${(getRandom(seed + 14) - 0.5) * 10}deg`
      }
    };
  }, [caseIndex, caseData.case_id, shuffleCount]);

  const submit = useCallback(async () => {
    if (!answer.trim() || isEval) return;
    setIsEval(true);
    const n = attempts + 1; setAttempts(n);
    try {
      const res = await fetch("/api/evaluate-answer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, caseTitle: caseData.title, question: caseData.question, expectedAnswer: caseData.expected_answer, acceptableVariations: caseData.acceptable_variations, userAnswer: answer.trim() })
      });
      const d = await res.json();
      setFeedback({ correct: d.correct, message: d.feedback });
      if (d.correct) {
        // Clear detective if generated when case is completed
        setAvatarData(null);
        setAvatarSession(null);
        setTimeout(() => onSolved(d.feedback, n), 2200);
      }
    } catch { setFeedback({ correct: false, message: "Something went wrong." }); }
    finally { setIsEval(false); }
  }, [answer, isEval, attempts, topic, caseData, onSolved]);

  return (
    <div className="case-hud h-screen w-full overflow-hidden relative">
      {/* Success Stamp Overlay */}
      {feedback?.correct && (
        <div className="fixed inset-0 z-[1000] pointer-events-none flex items-center justify-center anim-fadeIn">
          <div className="absolute inset-0 bg-emerald-950/20 backdrop-blur-[2px]" />
          <div className="case-solved-impact">
            <div className="ink-stamp !text-7xl !border-[8px] !text-emerald-600 !border-emerald-600 !px-12 !py-6 !rotate-[-15deg] shadow-[0_0_50px_rgba(16,185,129,0.3)] bg-white/5 backdrop-blur-sm">
              CASE SOLVED
            </div>
          </div>
        </div>
      )}

      {/* Evidence Modal */}
      {showEvidence && <EvidenceModal evidence={caseData.evidence} caseId={caseData.case_id} onClose={() => setShowEvidence(false)} />}

      {/* Decorative BG Elements */}
      <div className="case-bg-fingerprint" />
      <div className="case-bg-grid" />

      <div className="h-full w-full lg:grid lg:grid-cols-[100px_1fr_420px] relative z-10">

        {/* ═══ LEFT NAV STRIP (LEATHER) ═══ */}
        <div className="hidden lg:flex flex-col items-center py-6 gap-2 texture-leather border-r border-black/40 relative z-20">
          <button onClick={onBack} className="case-nav-btn mb-8 group" title="Back to Cases">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:-translate-x-0.5 transition-transform"><path d="m15 18-6-6 6-6" /></svg>
          </button>

          <div className="flex flex-col gap-4 w-full px-2">
            <button
              onClick={() => setActiveTab("mission")}
              className={`case-tab-btn ${activeTab === "mission" ? "active" : ""}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></svg>
              <span className="text-[9px] font-black uppercase tracking-tighter">Mission</span>
            </button>

            <button
              onClick={() => setActiveTab("evidence")}
              className={`case-tab-btn ${activeTab === "evidence" ? "active" : ""}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg>
              <span className="text-[9px] font-black uppercase tracking-tighter text-center">Evidence Board</span>
            </button>

            <button
              onClick={() => setActiveTab("forensic")}
              className={`case-tab-btn ${activeTab === "forensic" ? "active" : ""}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M7 7h4v4H7z" /><path d="M13 7h4v4h-4z" /><path d="M7 13h4v4H7z" /><path d="M13 13h4v4h-4z" /></svg>
              <span className="text-[9px] font-black uppercase tracking-tighter text-center">Lab</span>
            </button>

            <button
              onClick={() => setActiveTab("pc")}
              className={`case-tab-btn ${activeTab === "pc" ? "active" : ""}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="20" height="14" x="2" y="3" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></svg>
              <span className="text-[9px] font-black uppercase tracking-tighter">Terminal</span>
            </button>

          </div>

          <div className="mt-auto flex flex-col items-center gap-4">
            <div className="case-nav-pip done">
              <span className="text-[10px] font-black">{caseIndex + 1}</span>
            </div>
          </div>
        </div>

        {/* ═══ CENTER WORKSPACE ═══ */}
        <div className="flex flex-col h-full min-w-0 overflow-hidden">

          {/* Top Bar */}
          <div className="shrink-0 flex items-center justify-between px-8 py-4 border-b border-amber-800/[0.08] bg-amber-50/40">
            <div className="flex items-center gap-4">
              <div className="case-chapter-badge">
                <span className="text-[9px] text-amber-800/40 font-mono uppercase tracking-widest block">Chapter</span>
                <span className="text-amber-950 font-black text-lg leading-none">{caseIndex + 1}<span className="text-amber-800/30 font-medium">/{totalCases}</span></span>
              </div>
              <div className="h-8 w-px bg-amber-800/[0.08]" />
              <div>
                <p className="text-xs text-amber-800/40 font-mono uppercase tracking-widest">{feedback?.correct ? "✓ Resolved" : "● In Progress"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`case-badge ${caseData.difficulty === "Easy" ? "case-badge-green" : caseData.difficulty === "Medium" ? "case-badge-blue" : "case-badge-red"}`}>
                {caseData.difficulty.toUpperCase()}
              </span>
              <span className="case-badge">ATT: {attempts}</span>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto px-8 py-8 scrollbar-hide">

            {activeTab === "mission" && (
              <div className="space-y-8 anim-fadeIn max-w-4xl mx-auto">
                {/* ── CASE HEADER (PAPER SHEET) ── */}
                <div className="texture-paper p-10 pb-16 relative anim-fadeInUp overflow-hidden">
                  <div className="paperclip" />
                  <div className="coffee-stain top-[-20px] left-[-20px]" />

                  <div className="flex flex-col gap-1 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="ink-stamp">CLASSIFIED</div>
                      {feedback?.correct && (
                        <div className="ink-stamp !text-emerald-600 !border-emerald-600 !rotate-[12deg] anim-fadeInScale">SOLVED</div>
                      )}
                    </div>
                    <span className="text-xs font-mono text-amber-800/40 tracking-widest mt-2">FILE ID: {caseData.case_id}-{caseIndex + 1}</span>
                  </div>

                  <h1 className="text-4xl font-black text-amber-950 tracking-tight mb-8 font-serif leading-tight">{caseData.title}</h1>

                  <div className="space-y-6">
                    <p className="text-xl text-amber-900/80 leading-[2] font-medium font-serif italic border-l-2 border-amber-800/10 pl-8">
                      {caseData.scenario}
                    </p>
                  </div>

                  <div className="absolute bottom-10 right-10">
                    <div className="text-[10px] text-amber-800/20 font-mono uppercase tracking-[0.3em]">Department of Investigation</div>
                  </div>
                </div>

                <div className="texture-paper p-8 anim-fadeInUp d-300">
                  <div className="pin" />
                  <div className="case-panel-header !bg-transparent border-b-2 border-amber-800/5 mb-6">
                    <div className="flex items-center gap-2">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b6914" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></svg>
                      <span className="case-panel-title !text-amber-900 !text-sm">MISSION OBJECTIVES</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="space-y-3">
                      <div className="case-objective">
                        <div className={`case-checkbox ${showEvidence || feedback?.correct ? "checked" : ""}`}>
                          {(showEvidence || feedback?.correct) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>}
                        </div>
                        <span className={showEvidence || feedback?.correct ? "line-through text-slate-500" : ""}>Examine the evidence thoroughly.</span>
                      </div>

                      <div className="case-objective">
                        <div className={`case-checkbox ${feedback?.correct ? "checked" : ""}`}>
                          {feedback?.correct && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>}
                        </div>
                        <span className={feedback?.correct ? "line-through text-slate-500" : "font-semibold text-amber-900"}>Submit your findings.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "evidence" && (
              <div className="h-full flex flex-col anim-fadeIn max-w-6xl mx-auto pb-10">
                <style>{`
                  @keyframes swingPendulum {
                    0% { transform: rotate(-6deg); }
                    50% { transform: rotate(6deg); }
                    100% { transform: rotate(-6deg); }
                  }
                  .animate-swing-active {
                    animation: swingPendulum 4s ease-in-out infinite;
                    transform-origin: top center;
                  }
                `}</style>
                <div className="flex items-center justify-between px-2 mb-8">
                  <div className="flex flex-col">
                    <h2 className="text-3xl font-black text-amber-950 uppercase tracking-tighter leading-none">Evidence Board</h2>
                    <p className="text-[10px] text-amber-800/40 font-mono uppercase tracking-[0.4em] mt-2">Dossier: {caseData.case_id} // Materialized Evidence</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setShuffleCount(prev => prev + 1)}
                      className="p-2 hover:bg-amber-900/5 rounded-full transition-colors group"
                      title="Shuffle Evidence Board"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-900/40 group-hover:text-amber-900 group-active:rotate-180 transition-transform duration-500">
                        <path d="M2 18L22 6M2 6l20 12" />
                        <path d="M18 2h4v4M18 22h4v-4M2 2h4M2 22h4" />
                      </svg>
                    </button>
                    <div className="ink-stamp !text-[10px] !rotate-0 !border-2">RESTRICTED ACCESS</div>
                  </div>
                </div>

                <div className="relative">
                  {/* Interactive Rope Switch (Overflowing from Top) */}
                  <div
                    onClick={() => setIsBoardLightOn(!isBoardLightOn)}
                    className={`absolute -top-32 right-12 z-[70] cursor-pointer group transition-transform active:translate-y-2 duration-300`}
                  >
                    <div className="w-1 h-72 bg-amber-800/60 group-hover:bg-amber-600/80 transition-colors shadow-sm" /> {/* Rope */}
                    <div className="w-4 h-8 bg-amber-700 rounded-b-full -ml-[1.5px] shadow-2xl border border-amber-900/20 group-hover:bg-amber-600" /> {/* Pull Handle */}

                    {/* Visual Feedback Label */}
                    <div className="absolute top-[300px] right-0 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      <span className="text-[7px] font-mono text-amber-900/40 uppercase tracking-widest">Power Toggle</span>
                    </div>
                  </div>

                  {/* Industrial Hanging Lamp Visual with Swing Animation */}
                  <div className="absolute -top-32 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                    <div className={`flex flex-col items-center origin-top ${isBoardLightOn ? 'animate-swing-active' : ''}`}>
                      <div className="w-1 h-32 bg-zinc-800" /> {/* Main Cable */}
                      <div className="w-20 h-10 bg-zinc-800 rounded-t-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative border-b border-zinc-700"> {/* Lamp Body */}
                        {isBoardLightOn && (
                          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-yellow-300/60 rounded-full blur-xl animate-pulse" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`texture-cork rounded-xl border-[12px] border-amber-900/30 relative overflow-hidden p-6 h-[520px] shadow-2xl transition-all duration-700 ${!isBoardLightOn ? 'brightness-[0.15] saturate-50' : ''}`}>
                    {/* ═══ CLASSIFIED COVER ═══ */}
                    {!evidenceRevealed && (
                      <div className="absolute inset-0 z-[80] flex items-center justify-center" style={{ background: 'repeating-linear-gradient(135deg, #1c1917 0px, #1c1917 20px, #292524 20px, #292524 40px)' }}>
                        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(#fbbf24 1px, transparent 0)", backgroundSize: "30px 30px" }} />
                        <div className="relative z-10 flex flex-col items-center gap-6 text-center px-8">
                          <div className="w-20 h-20 rounded-full border-4 border-amber-500/30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                          </div>
                          <div>
                            <h3 className="text-2xl font-black text-amber-100 tracking-[0.2em] uppercase mb-2">Classified Evidence</h3>
                            <p className="text-xs text-amber-500/50 font-mono uppercase tracking-widest">Dossier {caseData.case_id} // Awaiting Materialization</p>
                          </div>
                          {evidenceGenerating ? (
                            <div className="flex flex-col items-center gap-5 w-72">
                              <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-amber-500/20 relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-progress-linear" style={{ width: '60%', left: '-20%' }} />
                                <div className="absolute inset-0 bg-amber-500/10 animate-pulse" />
                              </div>
                              <div className="flex flex-col items-center gap-1">
                                <p className="text-[10px] text-amber-400 font-mono tracking-[0.2em] uppercase">{genProgress}</p>
                                <div className="flex gap-1">
                                  <div className="w-1 h-1 bg-amber-500/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                  <div className="w-1 h-1 bg-amber-500/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                  <div className="w-1 h-1 bg-amber-500/40 rounded-full animate-bounce" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button onClick={handleGenerateEvidence} className="px-8 py-4 bg-gradient-to-b from-amber-600 to-amber-800 text-amber-100 font-black text-sm uppercase tracking-[0.3em] rounded-lg border border-amber-500/30 hover:brightness-110 hover:scale-105 transition-all shadow-2xl shadow-amber-900/40 cursor-pointer">
                              Generate Evidence
                            </button>
                          )}
                          <p className="text-[8px] text-amber-800/30 font-mono uppercase tracking-widest mt-4">Powered by RunwayML Gen4</p>
                        </div>
                      </div>
                    )}
                    {/* Atmospheric Overlays */}
                    {!isBoardLightOn && (
                      <div className="absolute inset-0 bg-blue-950/20 pointer-events-none z-[60]" />
                    )}

                    {isBoardLightOn && (
                      <div className="absolute inset-0 pointer-events-none z-[60] opacity-40"
                        style={{ backgroundImage: 'radial-gradient(circle at 50% -20%, rgba(255,251,235,0.4) 0%, transparent 60%)' }}
                      />
                    )}

                    {/* Decorative Red String (SVG) */}
                    <svg className="absolute inset-0 pointer-events-none w-full h-full z-10 opacity-30">
                      <line x1="15%" y1="15%" x2="45%" y2="25%" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 4" />
                      <line x1="45%" y1="25%" x2="35%" y2="55%" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 4" />
                      <line x1="35%" y1="55%" x2="75%" y2="20%" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 4" />
                    </svg>

                    {/* Item 2: The Description Letter */}
                    <div
                      onClick={() => setZoomedItem("letter")}
                      className="absolute w-[200px] texture-paper p-5 shadow-lg cursor-pointer hover:scale-105 transition-transform z-20"
                      style={{ top: boardLayout.letter.top, left: boardLayout.letter.left, transform: `rotate(${boardLayout.letter.rotate})` }}
                    >
                      <div className="paperclip" />
                      <div className="space-y-2">
                        <div className="h-px w-full bg-amber-800/10" />
                        <p className="text-[10px] text-amber-950 font-serif leading-relaxed line-clamp-4">
                          &quot;{caseData.evidence.description}&quot;
                        </p>
                        <div className="pt-2 flex justify-end">
                          <div className="ink-stamp !text-[5px] !rotate-[-10deg] !p-0.5 !border">REPORT</div>
                        </div>
                      </div>
                    </div>

                    {/* Item 3: The Newspaper Clipping */}
                    <div
                      onClick={() => setZoomedItem("newspaper")}
                      className="absolute w-[200px] bg-[#e5e7eb] p-4 shadow-md border-x-2 border-black/5 cursor-pointer hover:scale-105 transition-transform z-20"
                      style={{
                        top: boardLayout.news.top,
                        left: boardLayout.news.left,
                        transform: `rotate(${boardLayout.news.rotate})`,
                        backgroundImage: "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px)",
                        backgroundSize: "100% 12px"
                      }}
                    >
                      <div className="pin !bg-slate-400" />
                      <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-tighter mb-1 border-b border-slate-900 pb-0.5">The Daily Bulletin</h3>
                      <p className="text-[8px] text-slate-800 font-serif leading-tight line-clamp-2">
                        Investigative teams monitor {topic} developments...
                      </p>
                    </div>

                    {/* Field Report A: Surveillance Photo */}
                    <div
                      onClick={() => generatedImages.fieldA && setZoomedItem("fieldA")}
                      className={`absolute w-[160px] texture-paper p-2 pb-8 shadow-lg z-20 opacity-90 group ${generatedImages.fieldA ? 'cursor-pointer hover:scale-105 transition-transform' : 'cursor-not-allowed'}`}
                      style={{ top: boardLayout.fieldA.top, left: boardLayout.fieldA.left, transform: `rotate(${boardLayout.fieldA.rotate})` }}
                    >
                      <div className="pin !bg-blue-600" />
                      <div className="aspect-[4/3] bg-amber-950/20 relative overflow-hidden flex items-center justify-center border border-amber-800/10 group/img">
                        {generatedImages.fieldA ? (
                          <img src={generatedImages.fieldA} alt="Field Report A" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            {retryingIds.has("fieldA") ? (
                              <div className="w-6 h-6 border-2 border-amber-900/20 border-t-amber-900 rounded-full animate-spin" />
                            ) : (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRetryImage("fieldA"); }}
                                className="p-2 rounded-full bg-amber-900/5 hover:bg-amber-900/10 text-amber-900/40 hover:text-amber-900 transition-all"
                                title="Retry Generation"
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
                              </button>
                            )}
                            <span className="text-[7px] font-mono text-amber-900/30 uppercase tracking-tighter">Missing Material</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-center">
                        <span className="text-[8px] font-bold text-amber-900/40 uppercase tracking-widest">Field Report A</span>
                      </div>
                    </div>

                    {/* Tactical Photo Map (Landscape) */}
                    <div
                      onClick={() => setZoomedItem("map")}
                      className="absolute w-[320px] h-[160px] bg-[#2c2c2e] p-2 rounded-sm border-2 border-amber-900/20 shadow-2xl cursor-pointer hover:scale-[1.02] transition-transform z-20 overflow-hidden group"
                      style={{ top: boardLayout.map.top, left: boardLayout.map.left, transform: `rotate(${boardLayout.map.rotate})` }}
                    >
                      <div className="h-full w-full border border-blue-500/10 flex items-center justify-center relative bg-black/20 overflow-hidden">
                        {generatedImages.map ? (
                          <img src={generatedImages.map} alt="Tactical Map" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-10">
                            {retryingIds.has("map") ? (
                              <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                            ) : (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRetryImage("map"); }}
                                className="p-3 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400/50 hover:text-blue-400 transition-all border border-blue-500/20 shadow-lg backdrop-blur-sm"
                                title="Retry Generation"
                              >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
                              </button>
                            )}
                            <span className="text-[8px] font-mono text-blue-400/30 uppercase tracking-[0.2em] mt-2">Map Materialization Failed</span>
                          </div>
                        )}
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
                        {/* Tactical Markers Overlay */}
                        <div className="absolute top-1/4 left-1/3 z-10">
                          <div className="w-2 h-2 bg-red-600 rounded-full animate-ping absolute" />
                          <div className="w-2 h-2 bg-red-600 rounded-full relative" />
                        </div>
                        <div className="absolute top-2 left-3 text-[6px] font-mono text-blue-400/60 uppercase tracking-tighter z-10 bg-black/40 px-1 rounded">Sector 7G</div>
                        <div className="absolute bottom-2 right-3 text-[6px] font-mono text-blue-400/60 uppercase z-10 bg-black/40 px-1 rounded">Scale: 1:25000</div>
                      </div>
                      <div className="pin !bg-amber-800" />
                    </div>

                    {/* Field Report C: Forensic Detail (Portrait) */}
                    <div
                      onClick={() => generatedImages.fieldC && setZoomedItem("fieldC")}
                      className={`absolute w-[110px] texture-paper p-2 pb-6 shadow-lg z-20 opacity-90 group ${generatedImages.fieldC ? 'cursor-pointer hover:scale-105 transition-transform' : 'cursor-not-allowed'}`}
                      style={{ top: boardLayout.fieldC.top, left: boardLayout.fieldC.left, transform: `rotate(${boardLayout.fieldC.rotate})` }}
                    >
                      <div className="pin !bg-purple-600" />
                      <div className="aspect-[3/4] bg-amber-950/5 relative overflow-hidden border border-amber-800/10 flex items-center justify-center">
                        {generatedImages.fieldC ? (
                          <img src={generatedImages.fieldC} alt="Field Report C" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            {retryingIds.has("fieldC") ? (
                              <div className="w-5 h-5 border-2 border-amber-900/20 border-t-amber-900 rounded-full animate-spin" />
                            ) : (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRetryImage("fieldC"); }}
                                className="p-1.5 rounded-full bg-amber-900/5 hover:bg-amber-900/10 text-amber-900/30 hover:text-amber-900 transition-all"
                                title="Retry Generation"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
                              </button>
                            )}
                            <span className="text-[6px] font-mono text-amber-900/20 uppercase tracking-tighter">Missing Data</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-center">
                        <span className="text-[7px] font-bold text-amber-900/30 uppercase tracking-widest">Field Report C</span>
                      </div>
                    </div>

                    {/* Loose Decorative Pins */}
                    <div className="pin !bg-emerald-500 absolute top-[15%] left-[52%] opacity-60" />
                    <div className="pin !bg-amber-500 absolute top-[80%] left-[15%] opacity-40 shadow-none" />
                    <div className="pin !bg-red-500 absolute top-[45%] left-[95%] opacity-50" />
                    <div className="pin !bg-blue-500 absolute top-[85%] left-[75%] opacity-60" />
                    <div className="pin !bg-slate-300 absolute top-[65%] left-[45%] opacity-30 shadow-none" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "forensic" && (
              <div className="h-full flex lg:flex-row flex-col anim-fadeIn gap-6">
                {/* CLINICAL SUPPLY SIDEBAR */}
                <div className="w-full lg:w-64 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-200px)] scrollbar-hide">
                  <div className="flex flex-col mb-4">
                    <h2 className="text-3xl font-black text-emerald-950 uppercase tracking-tighter leading-none">LAB</h2>
                    <p className="text-[10px] text-emerald-600/40 font-mono uppercase tracking-[0.4em] mt-2">Evidence Samples</p>
                  </div>

                  <div className="space-y-3">
                    {labItems.map((item) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("nodeType", item.type);
                          e.dataTransfer.setData("nodeLabel", item.label);
                          e.dataTransfer.setData("labId", item.id);
                        }}
                        className="bg-white p-3 rounded-xl border border-emerald-100 cursor-grab active:cursor-grabbing hover:border-emerald-400 hover:shadow-md transition-all flex items-center gap-3 group relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-20" />
                        <span className="text-lg opacity-60">{item.icon}</span>
                        <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-widest">{item.label}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[8px] text-emerald-600/30 font-mono mt-2">Drag items onto the board and connect them to discover clues</p>

                  {caseData.lab_hint && (
                    <div className="mt-6 p-4 bg-emerald-900/5 rounded-xl border border-emerald-200/50 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-10">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A4.5 4.5 0 0 0 13.5 3.5c-2.8 0-4.5 2.1-4.5 4.5" /><path d="M9 14c.3 0 .6-.1.8-.4l.9-1.1" /><path d="M15 22h-6" /><path d="M15 18H9" /><path d="M12 14v4" /></svg>
                      </div>
                      <p className="text-[9px] font-mono text-emerald-600 uppercase tracking-widest mb-2 font-bold flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        Forensic Hint
                      </p>
                      <p className="text-[11px] text-emerald-900 leading-relaxed font-medium italic">
                        &quot;{caseData.lab_hint}&quot;
                      </p>
                    </div>
                  )}
                </div>

                {/* CLINICAL BOARD AREA */}
                <div
                  className="flex-1 bg-emerald-50/50 rounded-2xl border-8 border-emerald-100/50 relative overflow-hidden select-none min-h-[600px] shadow-inner"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const type = e.dataTransfer.getData("nodeType") as 'text' | 'image';
                    const label = e.dataTransfer.getData("nodeLabel");
                    const labId = e.dataTransfer.getData("labId") || undefined;
                    setNodes(prev => [...prev, { id: Date.now(), x, y, text: label, type, labId }]);
                  }}
                >
                  {/* Clinic Grid Pattern Overlay */}
                  <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "linear-gradient(#065f46 1px, transparent 1px), linear-gradient(90deg, #065f46 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

                  {/* Laboratory Glassware (Decorative - Scaled Up) */}
                  <div className="absolute bottom-0 right-6 z-50 flex items-end gap-2 opacity-80 pointer-events-none">
                    {/* Erlenmeyer Flask 1 (Emerald) */}
                    <div className="relative group">
                      <svg width="80" height="160" viewBox="0 0 80 160" fill="none" className="overflow-visible">
                        {/* Bubbles Animation */}
                        <circle cx="40" cy="30" r="3" fill="#10b981" opacity="0">
                          <animate attributeName="cy" from="30" to="-40" dur="2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0;0.8;0" dur="2s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="34" cy="30" r="2" fill="#10b981" opacity="0">
                          <animate attributeName="cy" from="30" to="-70" dur="3s" repeatCount="indefinite" begin="0.5s" />
                          <animate attributeName="opacity" values="0;0.8;0" dur="3s" repeatCount="indefinite" begin="0.5s" />
                        </circle>
                        <circle cx="46" cy="30" r="4" fill="#10b981" opacity="0">
                          <animate attributeName="cy" from="30" to="-50" dur="2.5s" repeatCount="indefinite" begin="1.2s" />
                          <animate attributeName="opacity" values="0;0.8;0" dur="2.5s" repeatCount="indefinite" begin="1.2s" />
                        </circle>

                        <path d="M30 50H50V70L76 150H4L30 70V50Z" fill="white" fillOpacity="0.1" stroke="#10b981" strokeWidth="2.5" />
                        <path d="M8 144H72L54 90H26L8 144Z" fill="#10b981" fillOpacity="0.4">
                          <animate attributeName="opacity" values="0.4;0.6;0.4" dur="3s" repeatCount="indefinite" />
                        </path>
                        <rect x="28" y="44" width="24" height="6" rx="2" fill="#10b981" />
                      </svg>
                    </div>

                    {/* Reagent Bottle (Cyan) */}
                    <div className="relative">
                      <svg width="60" height="90" viewBox="0 0 60 90" fill="none">
                        <rect x="4" y="20" width="52" height="64" rx="8" fill="white" fillOpacity="0.1" stroke="#065f46" strokeWidth="2.5" />
                        <rect x="8" y="50" width="44" height="30" rx="4" fill="#0ea5e9" fillOpacity="0.4" />
                        <rect x="20" y="4" width="20" height="16" rx="4" fill="#065f46" />
                      </svg>
                    </div>

                    {/* Erlenmeyer Flask 2 (Indigo) */}
                    <div className="relative">
                      <svg width="70" height="130" viewBox="0 0 80 160" fill="none" className="overflow-visible">
                        {/* Indigo Bubbles Animation */}
                        <circle cx="40" cy="40" r="2.5" fill="#8b5cf6" opacity="0">
                          <animate attributeName="cy" from="40" to="-20" dur="2.8s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0;0.6;0" dur="2.8s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="36" cy="40" r="1.5" fill="#8b5cf6" opacity="0">
                          <animate attributeName="cy" from="40" to="-50" dur="3.5s" repeatCount="indefinite" begin="0.8s" />
                          <animate attributeName="opacity" values="0;0.6;0" dur="3.5s" repeatCount="indefinite" begin="0.8s" />
                        </circle>

                        <path d="M30 50H50V70L76 150H4L30 70V50Z" fill="white" fillOpacity="0.1" stroke="#8b5cf6" strokeWidth="2.5" />
                        <path d="M12 136H68L56 100H24L12 136Z" fill="#8b5cf6" fillOpacity="0.4" />
                        <rect x="28" y="44" width="24" height="6" rx="2" fill="#8b5cf6" />
                      </svg>
                    </div>
                  </div>

                  <ForensicLab
                    nodes={nodes}
                    edges={edges}
                    onNodeDrag={(id, x, y) => {
                      setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
                    }}
                    onNodeDragStart={(id) => setDragNode(id)}
                    onNodeDragEnd={() => setDragNode(null)}
                    onToggleEdge={(from, to) => toggleEdge(from, to)}
                    onDeleteNode={(id) => {
                      if (id === 1) return;
                      setNodes(prev => prev.filter(n => n.id !== id));
                      setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
                    }}
                    onRunAnalysis={handleRunAnalysis}
                    runningNodeIds={runningNodeIds}
                  />

                  {/* Visual Output Image Overlays (rendered over the Konva canvas) */}
                  {nodes.filter(n => n.type === 'image').map(imageNode => {
                    const comboKey = nodeComboMap[imageNode.id];
                    const result = comboKey ? labComboResults[comboKey] : null;

                    // If no result for this node, but it's the default output node (id: 1), 
                    // show the latest overall result as a fallback
                    let finalResult = result;
                    if (!finalResult && imageNode.id === 1) {
                      const resultsArray = Object.values(labComboResults);
                      finalResult = resultsArray[resultsArray.length - 1];
                    }

                    if (!finalResult && imageNode.id !== 1) return null;

                    return (
                      <div
                        key={imageNode.id}
                        className={`absolute z-40 transition-all ${finalResult?.imageUrl ? 'pointer-events-auto cursor-pointer hover:scale-105' : 'pointer-events-none'}`}
                        style={{ left: imageNode.x - 40, top: imageNode.y - 50, width: 80, height: 80 }}
                        onClick={() => {
                          if (finalResult?.imageUrl) {
                            // Find the key associated with this result in labComboResults
                            let resultKey = comboKey;
                            if (!resultKey) {
                              // If it's a fallback result, find the key that matches the result object
                              const entries = Object.entries(labComboResults);
                              const match = entries.find(([_, r]) => r.imageUrl === finalResult.imageUrl);
                              resultKey = match ? match[0] : entries[entries.length - 1]?.[0];
                            }

                            if (resultKey) {
                              setZoomedLabComboKey(resultKey);
                              setZoomedItem("labResult");
                            }
                          }
                        }}
                      >
                        {finalResult?.loading ? (
                          <div className="w-full h-full flex items-center justify-center bg-white/80 rounded-sm border border-emerald-200">
                            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                          </div>
                        ) : finalResult?.imageUrl ? (
                          <img src={finalResult.imageUrl} alt="Analysis Result" className="w-full h-full object-cover rounded-sm border border-emerald-300/50 shadow-sm" />
                        ) : imageNode.id === 1 ? (
                          <div className="w-full h-full flex items-center justify-center bg-emerald-50/50 rounded-sm border border-dashed border-emerald-300/40">
                            <p className="text-[7px] text-emerald-600/40 font-mono uppercase text-center px-1">Connect items to generate</p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "pc" && (
              <div className="h-full flex flex-col anim-fadeIn max-w-5xl mx-auto pb-10">
                <div className="flex items-center justify-between px-2 mb-6">
                  <div className="flex flex-col">
                    <h2 className="text-3xl font-black text-amber-950 uppercase tracking-tighter leading-none">Evidence Terminal</h2>
                    <p className="text-[10px] text-amber-800/40 font-mono uppercase tracking-[0.4em] mt-2">Model: OS-88 // Neural Link Established</p>
                  </div>
                  <div className="ink-stamp !text-[10px] !rotate-0 !border-2 !text-blue-600/40 !border-blue-600/40">SYSTEM_ONLINE</div>
                </div>

                <div className="flex-1 bg-slate-950 rounded-2xl p-4 shadow-2xl relative border-4 border-slate-900 min-h-[550px] overflow-hidden">
                  {/* Metallic Bezel Shine */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                  {/* CRT Screen Area */}
                  <div className="w-full h-full bg-[#1c2e26] rounded-lg relative overflow-hidden border-2 border-black shadow-inner flex flex-col">
                    {/* CRT Scanline Effect */}
                    <div className="absolute inset-0 pointer-events-none z-10 bg-scanline opacity-20" />
                    <div className="absolute inset-0 pointer-events-none z-10 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />

                    {/* ACCESS DENIED POPUP */}
                    {pcError && (
                      <div className="absolute inset-0 z-[100] flex items-center justify-center anim-fadeIn">
                        <div className="absolute inset-0 bg-red-950/40 backdrop-blur-sm" />
                        <div className="relative z-10 bg-red-600 px-8 py-4 border-4 border-white shadow-[0_0_30px_rgba(220,38,38,0.5)] rotate-[-2deg] anim-zoomIn">
                          <h4 className="text-white font-black text-2xl tracking-[0.2em] animate-pulse">ACCESS DENIED</h4>
                          <p className="text-white/80 font-mono text-[10px] text-center mt-1 uppercase">Incorrect Security Key</p>
                        </div>
                      </div>
                    )}

                    {pcLocked ? (
                      /* RETRO LOGIN SCREEN */
                      <div className="flex-1 flex flex-col items-center justify-center anim-fadeIn relative z-20">
                        <div className="mb-8 text-center">
                          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                          </div>
                          <h3 className="text-xl font-mono text-emerald-500 font-black tracking-[0.2em]">TERMINAL LOCKED</h3>
                          <p className="text-[10px] font-mono text-emerald-500/40 mt-1 uppercase">Enter Security Credentials</p>
                        </div>
                        <div className="w-64 space-y-4">
                          <input
                            type="password"
                            value={pcPasswordInput}
                            onChange={(e) => setPcPasswordInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handlePcLogin()}
                            placeholder="PASSWORD_"
                            className="w-full bg-black/40 border border-emerald-500/30 rounded px-4 py-3 text-emerald-500 font-mono text-center focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-emerald-500/20"
                          />
                          <button
                            onClick={handlePcLogin}
                            className="w-full py-3 bg-emerald-500 text-black font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all"
                          >
                            Authenticate
                          </button>
                        </div>
                      </div>
                    ) : !terminalInterfaceStarted ? (
                      /* ACCESS GRANTED - START INTERFACE BUTTON */
                      <div className="flex-1 flex flex-col items-center justify-center anim-fadeIn relative z-20">
                        <div className="text-center mb-8">
                          <div className="ink-stamp !text-[12px] !rotate-0 !border-2 !text-emerald-500 !border-emerald-500 mb-6 mx-auto inline-block">ACCESS_GRANTED</div>
                          <h3 className="text-2xl font-black text-emerald-500 uppercase tracking-tighter">Forensic Link Ready</h3>
                          <p className="text-xs font-mono text-emerald-500/60 mt-2 max-w-sm">Neural uplink established. Ready to materialize deep-source surveillance and audio intercepts.</p>
                        </div>
                        <button
                          onClick={handleStartTerminalInterface}
                          className="group relative flex items-center gap-4 px-10 py-6 bg-emerald-500 hover:bg-emerald-400 transition-all active:scale-95 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                        >
                          <div className="absolute inset-0 border-2 border-white/20 animate-pulse" />
                          <span className="text-black font-black text-sm uppercase tracking-[0.3em]">Initialize Interface</span>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" className="group-hover:translate-x-1 transition-transform"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                        </button>
                      </div>
                    ) : (
                      /* DESKTOP VIEW WITH FOLDERS */
                      <div className="flex-1 flex flex-col anim-fadeIn relative z-20">
                        <div className="flex-1 p-10 grid grid-cols-4 content-start gap-10">
                          {/* Folder: Videos */}
                          <div
                            onClick={() => setPcFolderOpen("videos")}
                            className="flex flex-col items-center gap-2 cursor-pointer group hover:scale-105 transition-transform"
                          >
                            <div className="w-16 h-14 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-sm relative flex items-center justify-center group-hover:bg-emerald-500/20 transition-all">
                              <div className="absolute -top-2 left-0 w-6 h-2 bg-emerald-500/20 border-x-2 border-t-2 border-emerald-500/20 rounded-t-sm" />
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500 opacity-60"><polygon points="23 7 16 12 23 17 23 7" /><rect width="15" height="14" x="1" y="5" rx="2" ry="2" /></svg>
                            </div>
                            <span className="text-[10px] font-mono text-emerald-500/60 font-bold bg-black/40 px-2 py-0.5 rounded uppercase group-hover:text-emerald-500">Videos</span>
                          </div>

                          {/* Folder: Audio */}
                          <div
                            onClick={() => setPcFolderOpen("audio")}
                            className="flex flex-col items-center gap-2 cursor-pointer group hover:scale-105 transition-transform"
                          >
                            <div className="w-16 h-14 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-sm relative flex items-center justify-center group-hover:bg-emerald-500/20 transition-all">
                              <div className="absolute -top-2 left-0 w-6 h-2 bg-emerald-500/20 border-x-2 border-t-2 border-emerald-500/20 rounded-t-sm" />
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500 opacity-60"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                            </div>
                            <span className="text-[10px] font-mono text-emerald-500/60 font-bold bg-black/40 px-2 py-0.5 rounded uppercase group-hover:text-emerald-500">Audio</span>
                          </div>
                        </div>

                        {/* Explorer Window (Modal style inside PC) */}
                        {pcFolderOpen && (
                          <div className="absolute inset-0 z-20 flex items-center justify-center p-10 anim-fadeIn">
                            <div className="absolute inset-0 bg-black/60" onClick={() => setPcFolderOpen(null)} />
                            <div className="bg-[#1c2e26] border-2 border-emerald-500/40 rounded shadow-2xl w-full max-w-lg relative z-30 flex flex-col overflow-hidden h-[400px]">
                              <div className="p-2 border-b border-black/40 flex justify-between items-center bg-[#13221c]">
                                <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                                  Explorer // C:\{pcFolderOpen.toUpperCase()}
                                </span>
                                <button onClick={() => setPcFolderOpen(null)} className="hover:text-red-500 text-emerald-500">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                </button>
                              </div>
                              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                                {pcFolderOpen === 'videos' ? (
                                  <div
                                    onClick={() => setPcSelectedFile({ name: "FORENSIC_FEED.MP4", type: "video" })}
                                    className="flex items-center gap-3 p-2 hover:bg-emerald-500/10 cursor-pointer border border-transparent hover:border-emerald-500/20 rounded group transition-all"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500/40 group-hover:text-emerald-400"><polygon points="23 7 16 12 23 17 23 7" /><rect width="15" height="14" x="1" y="5" rx="2" ry="2" /></svg>
                                    <span className="text-[10px] font-mono text-emerald-500/60 group-hover:text-emerald-400 uppercase">FORENSIC_FEED.MP4</span>
                                    {terminalGenerating && <div className="ml-auto w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
                                  </div>
                                ) : (
                                  <div
                                    onClick={() => setPcSelectedFile({ name: "INTERCEPT_01.WAV", type: "audio" })}
                                    className="flex items-center gap-3 p-2 hover:bg-emerald-500/10 cursor-pointer border border-transparent hover:border-emerald-500/20 rounded group transition-all"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500/40 group-hover:text-emerald-400"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                                    <span className="text-[10px] font-mono text-emerald-500/60 group-hover:text-emerald-400 uppercase">INTERCEPT_01.WAV</span>
                                    {terminalGenerating && <div className="ml-auto w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Media Player Window */}
                        {pcSelectedFile && (
                          <div className="absolute inset-0 z-[100] flex items-center justify-center p-10 anim-fadeIn">
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPcSelectedFile(null)} />
                            <div className="bg-[#1c2e26] border-2 border-emerald-500/40 rounded shadow-2xl w-full max-w-2xl relative z-30 flex flex-col overflow-hidden">
                              <div className="p-2 border-b border-black/40 flex justify-between items-center bg-[#13221c]">
                                <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                  Player // {pcSelectedFile.name}
                                </span>
                                <button onClick={() => setPcSelectedFile(null)} className="hover:text-red-500 text-emerald-500">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                </button>
                              </div>

                              <div className="flex-1 bg-black p-4 relative min-h-[300px] flex items-center justify-center">
                                {terminalGenerating ? (
                                  <div className="flex flex-col items-center gap-4">
                                    <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                                    <p className="text-[10px] font-mono text-emerald-500 animate-pulse uppercase">Syncing Uplink...</p>
                                  </div>
                                ) : pcSelectedFile.type === 'video' ? (
                                  terminalVideoUrl ? (
                                    <video src={terminalVideoUrl} autoPlay loop controls className="w-full h-full object-contain opacity-80" />
                                  ) : (
                                    <div className="text-emerald-500/20 text-[10px] font-mono uppercase tracking-[0.3em]">No_Video_Data</div>
                                  )
                                ) : (
                                  <div className="w-full flex flex-col items-center justify-center space-y-10 p-10">
                                    <div className="flex items-center gap-1.5 h-24 w-full justify-center">
                                      {[...Array(30)].map((_, i) => (
                                        <div
                                          key={i}
                                          className={`w-1 rounded-full transition-all duration-300 ${terminalAudioPlaying ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-emerald-500/20'}`}
                                          style={{
                                            height: terminalAudioPlaying ? `${Math.random() * 80 + 20}%` : '10%',
                                            animationDelay: `${i * 0.05}s`
                                          }}
                                        />
                                      ))}
                                    </div>

                                    {terminalAudioUrl && (
                                      <div className="flex flex-col items-center gap-6 w-full max-w-xs">
                                        <audio
                                          ref={terminalAudioRef}
                                          src={terminalAudioUrl}
                                          onPlay={() => setTerminalAudioPlaying(true)}
                                          onPause={() => setTerminalAudioPlaying(false)}
                                          onEnded={() => setTerminalAudioPlaying(false)}
                                          className="hidden"
                                        />
                                        <div className="w-full flex items-center justify-between px-2 text-[8px] font-mono text-emerald-500/40 uppercase tracking-widest">
                                          <span>00:00:00</span>
                                          <div className="flex-1 mx-4 h-0.5 bg-emerald-950 relative">
                                            <div className="absolute inset-0 bg-emerald-500/10" />
                                            <div
                                              className="h-full bg-emerald-500/60 relative"
                                              style={{ width: terminalAudioPlaying ? '40%' : '0%', transition: 'width 0.2s' }}
                                            >
                                              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-emerald-500 rounded-full" />
                                            </div>
                                          </div>
                                          <span>DECRYPTED</span>
                                        </div>

                                        <button
                                          onClick={() => {
                                            if (!terminalAudioRef.current) return;
                                            if (terminalAudioPlaying) {
                                              terminalAudioRef.current.pause();
                                            } else {
                                              terminalAudioRef.current.play();
                                            }
                                          }}
                                          className="px-10 py-4 bg-emerald-500 text-black font-black text-xs uppercase tracking-[0.4em] hover:bg-emerald-400 transition-all flex items-center gap-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                                        >
                                          {terminalAudioPlaying ? (
                                            <>
                                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                                              Pause Intercept
                                            </>
                                          ) : (
                                            <>
                                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="m7 4 12 8-12 8V4z" /></svg>
                                              Play Intercept
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="absolute inset-0 pointer-events-none border-[10px] border-black/10" />
                              </div>

                              <div className="bg-[#13221c] p-2 px-4 border-t border-black/40 flex items-center justify-between">
                                <span className="text-[8px] font-mono text-emerald-500/40 uppercase tracking-widest">
                                  {pcSelectedFile.type === 'video' ? 'BUFFERING_STREAM' : 'DECRYPTING_AUDIO'}
                                </span>
                                <span className="text-[8px] font-mono text-emerald-500/60 animate-pulse">● LIVE</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="bg-[#13221c] p-2 px-4 border-t border-black/40 flex items-center gap-4">
                          <div className="w-16 py-1 bg-emerald-500/20 text-emerald-500 text-[9px] font-black text-center rounded border border-emerald-500/40">START</div>
                          <div className="h-4 w-px bg-emerald-500/20" />
                          <span className="text-[8px] font-mono text-emerald-500/40 uppercase tracking-widest">System: Neural_Uplink_Active</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT PANEL (LEATHER) ═══ */}
        <div className="hidden lg:flex flex-col h-full border-l-4 border-black/20 texture-leather overflow-hidden relative z-20">

          {/* AI AGENT MATERIALIZATION (TOP PRIORITY) */}
          <div className="shrink-0 p-4 border-b border-black/20 bg-amber-950/30">
            {!avatarData ? (
              <div className="relative group">
                <div className="absolute inset-0 bg-emerald-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <button
                  onClick={handleCreateAvatar}
                  disabled={avatarCreating}
                  className="w-full aspect-video rounded-xl border-2 border-emerald-500/20 bg-black/40 flex flex-col items-center justify-center gap-2 transition-all hover:border-emerald-500/50 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-scanline opacity-5" />
                  {avatarCreating ? (
                    <>
                      <div className="w-8 h-8 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                      <span className="text-[8px] text-emerald-500 font-black uppercase tracking-[0.3em]">{creationStage}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-emerald-500/5 flex items-center justify-center border border-emerald-500/10 mb-1">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-emerald-500/40"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                      </div>
                      <span className="text-[8px] text-emerald-500 font-black uppercase tracking-[0.3em]">Call Agent</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="anim-slideUp flex flex-col gap-2">
                <div className={`w-full aspect-video rounded-xl bg-black border-2 border-emerald-500/30 overflow-hidden relative shadow-2xl group transition-all duration-500`}>
                  {avatarSession?.sessionId ? (
                    <div className="w-full h-full relative">
                      <Suspense fallback={
                        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[#0a110e]">
                          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                          <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest text-center px-4">Establishing Connection...</span>
                        </div>
                      }>
                        <AvatarCall
                          avatarId={avatarData.id}
                          sessionId={avatarSession.sessionId}
                          sessionKey={avatarSession.sessionKey}
                          avatarImageUrl={avatarData.previewUrl}
                          video={false}
                          onEnd={() => setAvatarSession(null)}
                          onError={(err) => console.error("Avatar Call Error:", err)}
                        />
                      </Suspense>
                      {/* Session Overlay */}
                      <div className="absolute top-2 right-2 flex gap-1 pointer-events-none z-10">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                        <span className="text-[8px] font-mono text-emerald-500 uppercase tracking-widest bg-black/40 px-1 rounded">Live</span>
                      </div>
                      <button
                        onClick={() => setAvatarSession(null)}
                        className="absolute bottom-2 right-2 p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-500 border border-red-500/40 rounded transition-colors z-20"
                        title="Terminate Briefing"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-full relative group cursor-pointer" onClick={handleStartSession}>
                      <div className={`absolute inset-0 bg-emerald-500/20 blur-2xl transition-opacity opacity-0 group-hover:opacity-40`} />
                      {avatarData.previewUrl ? (
                        <img src={avatarData.previewUrl} alt="Avatar" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-emerald-950/20">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-emerald-500/40"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                        </div>
                      )}

                      <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-black shadow-lg shadow-emerald-500/20">
                          {sessionStarting ? (
                            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="m7 4 12 8-12 8V4z" /></svg>
                          )}
                        </div>
                        <span className="mt-2 text-[8px] font-black text-emerald-500 uppercase tracking-[0.4em]">
                          {sessionStarting ? 'Uplink...' : 'Start'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="font-black text-xs text-amber-100 uppercase tracking-widest">
                    {character.role || (character.name.match(/^(Detective|Inspector|Dr|Doctor)/i) ? '' : 'Detective')} {character.name}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable Investigation Area */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {/* Detective Briefing - Intelligence Bubble (Top Format) */}
            <div className="p-4 bg-amber-950/10 border-b border-black/20 relative overflow-hidden">
              <div className="bg-amber-950/20 backdrop-blur-md border border-amber-500/10 p-6 rounded-2xl rounded-bl-none relative anim-slideUp shadow-2xl">
                {/* Bubble Arrow pointing down toward the Question */}
                <div className="absolute -bottom-2 left-8 w-4 h-4 bg-amber-950/40 rotate-45 border-r border-b border-amber-500/10 z-0" />

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest">Neural Link: {character.name}</span>
                  </div>
                  <div className="text-amber-100 font-serif italic border-l-2 border-amber-500/20 pl-4">
                    <div className="text-sm text-amber-50 font-bold leading-relaxed">
                      <Typewriter text={caseData.character_dialogue} speed={25} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Header - Now Question (WIDE & HIGH CONTRAST) */}
            <div className="shrink-0 px-4 py-6 border-b border-black/40 bg-black/60 shadow-inner">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-[10px] text-amber-400 font-black uppercase tracking-[0.3em]">Investigation Question</p>
              </div>
              <p className="text-white font-black text-lg leading-snug tracking-tight font-serif italic underline decoration-amber-500/40 underline-offset-4">
                {caseData.question}
              </p>
            </div>

            <div className="shrink-0 p-4 bg-amber-950/5">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder="Enter your 1-word final analysis..."
                className="w-full h-24 bg-black/50 border border-black/20 rounded-lg p-5 text-amber-100 text-sm focus:ring-1 focus:ring-amber-500/50 outline-none transition-all placeholder:text-amber-100/10 font-mono mb-4"
                disabled={feedback?.correct}
              />
              <button onClick={submit} disabled={!answer.trim() || isEval || feedback?.correct} className="w-full py-4 rounded bg-gradient-to-b from-amber-700 to-amber-900 border border-amber-600/30 text-amber-100 font-black text-sm uppercase tracking-[0.4em] hover:brightness-110 disabled:opacity-30 disabled:grayscale transition-all shadow-xl shadow-black/40">
                {isEval ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing</>
                ) : feedback?.correct ? (
                  <>Submitted</>
                ) : (
                  <>Submit Report</>
                )}
              </button>
            </div>

            {/* Feedback / Debrief */}
            <div className="px-8 py-6">
              {feedback ? (
                <div className="anim-slideUp space-y-6">
                  <div className={`p-5 rounded border ${feedback.correct ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${feedback.correct ? "text-emerald-400" : "text-red-400"}`}>
                      {feedback.correct ? "Transmission Successful" : "Data Inconsistent"}
                    </p>
                    <p className="text-sm text-amber-100/80 leading-relaxed font-serif italic">{feedback.message}</p>
                  </div>
                  {feedback.correct && (
                    <div className="texture-paper !p-6 !rounded-sm !shadow-none !bg-white/5 border border-white/5">
                      <p className="text-[10px] text-amber-100/20 font-black uppercase tracking-[0.3em] mb-4">Official Debriefing</p>
                      <p className="text-xs text-amber-100/40 leading-relaxed font-serif italic">{caseData.explanation}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center opacity-10 grayscale">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                  <p className="text-[10px] font-mono text-white mt-4 uppercase tracking-[0.5em]">System Idle</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Zoom Overlay (Modal style) - Placed at root for visibility across all tabs */}
      {
        zoomedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-10 anim-fadeIn">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => { setZoomedItem(null); setZoomedLabComboKey(null); }} />
            <div className="relative z-10 max-w-4xl w-full anim-zoomIn">
              <button onClick={() => { setZoomedItem(null); setZoomedLabComboKey(null); }} className="absolute -top-12 right-0 text-white flex items-center gap-2 uppercase text-xs font-black tracking-widest hover:text-amber-500 transition-colors">
                Close Analysis <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>

              {zoomedItem === "media" && (
                <div className="texture-paper p-10">
                  <div className="paperclip" />
                  <div className="flex flex-col gap-6">
                    <div className="aspect-video bg-black/10 rounded-sm relative group overflow-hidden border-4 border-white shadow-2xl">
                      {caseData.evidence.url ? (
                        caseData.evidence.type === 'video' ? (
                          <video src={caseData.evidence.url} className="w-full h-full object-cover" controls autoPlay loop />
                        ) : (
                          <img src={caseData.evidence.url} alt="Evidence" className="w-full h-full object-cover" />
                        )
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <p className="text-sm font-bold text-amber-900/40 uppercase tracking-widest">Awaiting Materialization...</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t border-amber-800/10 pt-6">
                      <div>
                        <p className="text-[10px] text-amber-800/40 font-mono uppercase">Reference #</p>
                        <p className="font-bold text-amber-950 font-serif">VISUAL_SOURCE_{caseData.case_id}</p>
                      </div>
                      <div className="ink-stamp !text-[12px]">VERIFIED_DATA</div>
                    </div>
                  </div>
                </div>
              )}

              {zoomedItem === "labResult" && zoomedLabComboKey && (() => {
                const result = labComboResults[zoomedLabComboKey];
                if (!result) return null;
                return (
                  <div className="texture-paper p-8 rounded-sm shadow-2xl relative overflow-hidden border-8 border-white/20">
                    <div className="paperclip" />
                    <div className="mb-6">
                      <p className="text-[10px] text-emerald-800/40 font-mono uppercase tracking-widest">Lab Analysis Result</p>
                      <h3 className="text-xl font-black text-emerald-950 uppercase tracking-tighter">CLUE_DISCOVERED</h3>
                    </div>

                    {result.imageUrl && (
                      <div className="relative group mb-6 bg-emerald-900/5 p-1 rounded">
                        <img src={result.imageUrl} alt="Analysis Result" className="w-full max-h-[50vh] object-contain rounded" />
                      </div>
                    )}

                    <div className="bg-white/50 p-6 rounded-lg border border-emerald-100 mb-6">
                      <p className="text-emerald-950 font-medium leading-relaxed italic">
                        &quot;{result.clue}&quot;
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-emerald-800/10 pt-4">
                      <div>
                        <p className="text-[10px] text-emerald-800/40 font-mono uppercase">Forensic ID</p>
                        <p className="font-bold text-emerald-950 font-serif">ANALYSIS_{caseData.case_id}_{zoomedLabComboKey.slice(0, 4)}</p>
                      </div>
                      <div className="ink-stamp !text-[10px] !text-emerald-700 !border-emerald-700/50">CONFIRMED</div>
                    </div>
                  </div>
                );
              })()}

              {zoomedItem === "letter" && (
                <div className="texture-paper p-16 relative overflow-hidden">
                  <div className="paperclip" />
                  <div className="coffee-stain top-[-30px] right-[-30px]" />
                  <div className="mb-10 flex justify-between items-start">
                    <div>
                      <p className="text-xs font-mono text-amber-800/40 uppercase tracking-widest mb-1">Internal Forensic Memo</p>
                      <p className="text-xs text-amber-900 font-bold">CASE: {caseData.title}</p>
                    </div>
                    <div className="text-[10px] text-amber-800/30 font-mono">DATE: 2026.05.03</div>
                  </div>
                  <p className="text-2xl text-amber-950 font-serif leading-relaxed italic border-l-4 border-amber-800/10 pl-10 py-4">
                    &quot;{caseData.evidence.description}&quot;
                  </p>
                  <div className="mt-16 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-900/5 border border-amber-800/10" />
                    <div>
                      <p className="text-[10px] font-black text-amber-950 uppercase">Analysis Lead</p>
                      <p className="text-xs text-amber-800/40 font-mono">Authentication Confirmed</p>
                    </div>
                  </div>
                  <div className="absolute bottom-[-20px] right-[-20px] opacity-10">
                    <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                  </div>
                </div>
              )}

              {zoomedItem === "newspaper" && (
                <div className="bg-[#f4f1ea] p-12 shadow-2xl relative overflow-hidden border-x-[20px] border-black/5">
                  <div className="border-b-4 border-black pb-4 mb-8">
                    <div className="flex justify-between items-end">
                      <h2 className="text-6xl font-black tracking-tighter text-slate-950">THE OBSERVER</h2>
                      <div className="text-right font-serif text-[10px] text-slate-600">
                        <span>FRIDAY EDITION</span>
                        <span>PRICE: ONE PENNY</span>
                      </div>
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold text-slate-900 leading-tight mb-6">UNEXPLAINED ANOMALY AT {topic.toUpperCase()} FACILITY SHOCKS RESEARCHERS</h3>
                  <div className="columns-2 gap-10 text-sm text-slate-800 font-serif leading-relaxed">
                    <p className="mb-4 first-letter:text-5xl first-letter:font-black first-letter:float-left first-letter:mr-2">I</p>
                    <p className="mb-4">Witnesses reported strange occurrences late last night as security forces swarmed the perimeter. &quot;Everything seemed normal until the lights started flickering in patterns we'd never seen,&quot; said one local resident. Experts are currently analyzing the data fragments recovered from the scene.</p>
                    <p>The implications of this breach extend far beyond the laboratory walls, suggesting a fundamental shift in our understanding of the current operational parameters.</p>
                  </div>
                </div>
              )}

              {zoomedItem === "map" && (
                <div className="texture-paper !bg-amber-100/50 p-1 rounded-sm shadow-2xl h-[70vh] relative overflow-hidden border-8 border-white/20">
                  <div className="absolute inset-0 pointer-events-none z-10" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
                  <div className="w-full h-full relative overflow-hidden bg-[#e6dccb]">
                    {generatedImages.map ? (
                      <img src={generatedImages.map} alt="Tactical Map" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] border-4 border-amber-900/5 rounded-full" />
                        <div className="absolute top-1/3 left-1/4 w-12 h-12 bg-red-600/20 rounded-full animate-pulse flex items-center justify-center">
                          <div className="w-2 h-2 bg-red-600 rounded-full" />
                        </div>
                      </>
                    )}
                    <div className="absolute bottom-10 right-10 p-4 bg-white/40 backdrop-blur-md border border-amber-900/10 rounded z-20">
                      <p className="text-[10px] font-black text-amber-950 uppercase mb-2">Operational Grid</p>
                      <div className="space-y-1">
                        <div className="h-1 w-20 bg-amber-900/20" />
                        <div className="h-1 w-16 bg-amber-900/20" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(zoomedItem === "fieldA" || zoomedItem === "fieldC") && generatedImages[zoomedItem] && (
                <div className="texture-paper p-4 rounded-sm shadow-2xl relative overflow-hidden border-8 border-white/20">
                  <div className="paperclip" />
                  <img src={generatedImages[zoomedItem]} alt={`Field Report ${zoomedItem === "fieldA" ? "A" : "C"}`} className="w-full max-h-[70vh] object-contain rounded" />
                  <div className="flex items-center justify-between border-t border-amber-800/10 pt-4 mt-4">
                    <div>
                      <p className="text-[10px] text-amber-800/40 font-mono uppercase">Evidence</p>
                      <p className="font-bold text-amber-950 font-serif">{zoomedItem === "fieldA" ? "SURVEILLANCE_PHOTO" : "FORENSIC_DETAIL"}_{caseData.case_id}</p>
                    </div>
                    <div className="ink-stamp !text-[10px]">AI_GENERATED</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }
    </div >
  );
}

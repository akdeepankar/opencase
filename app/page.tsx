"use client";
import { useState, useCallback } from "react";
import { GamePhase, Case, DetectiveCharacter, CaseAnswer } from "./types";
import LandingScreen from "./components/LandingScreen";
import LoadingScreen from "./components/LoadingScreen";
import Dashboard from "./components/Dashboard";
import CaseView from "./components/CaseView";
import ReportScreen from "./components/ReportScreen";
import CinematicScreen from "./components/CinematicScreen";
import { DEMO_TOPIC, DEMO_CHARACTER, DEMO_CASES, DEMO_INVESTIGATION_TITLE, PHOTOSYNTHESIS_TOPIC, PHOTOSYNTHESIS_CHARACTER, PHOTOSYNTHESIS_CASES, PHOTOSYNTHESIS_INVESTIGATION_TITLE } from "./demoData";

export default function Home() {
  const [phase, setPhase] = useState<GamePhase>("landing");
  const [topic, setTopic] = useState("");
  const [investigationTitle, setInvestigationTitle] = useState("");
  const [character, setCharacter] = useState<DetectiveCharacter | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
  const [answers, setAnswers] = useState<CaseAnswer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(async (inputTopic: string) => {
    setTopic(inputTopic);
    setPhase("loading");
    setError(null);

    // Skip API for demo mode
    if (inputTopic === DEMO_TOPIC || inputTopic === PHOTOSYNTHESIS_TOPIC) {
      const isPhoto = inputTopic === PHOTOSYNTHESIS_TOPIC;
      setTimeout(() => {
        setCharacter(isPhoto ? PHOTOSYNTHESIS_CHARACTER : DEMO_CHARACTER);
        setInvestigationTitle(isPhoto ? PHOTOSYNTHESIS_INVESTIGATION_TITLE : DEMO_INVESTIGATION_TITLE);
        const sourceCases = isPhoto ? PHOTOSYNTHESIS_CASES : DEMO_CASES;
        setCases(sourceCases.map((c, i) => ({ ...c, status: i === 0 ? "unlocked" : "locked" })));
        setCurrentCaseIndex(0);
        setAnswers([]);
        setPhase("cinematic");
      }, 1000); // Small delay for "loading" feel
      return;
    }

    try {
      const res = await fetch("/api/generate-cases", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: inputTopic }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to generate cases"); }
      const data = await res.json();
      if (!data.character || !data.cases?.length) throw new Error("Invalid AI response");
      setCharacter(data.character);
      setInvestigationTitle(data.investigation_title || inputTopic);
      setCases(data.cases.map((c: Case, i: number) => ({ ...c, status: i === 0 ? "unlocked" : "locked" })));
      setCurrentCaseIndex(0);
      setAnswers([]);
      setPhase("cinematic");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("landing");
    }
  }, []);

  const handleSelectCase = useCallback((i: number) => { setCurrentCaseIndex(i); setPhase("case"); }, []);

  const handleCaseSolved = useCallback((feedback: string, attemptCount: number) => {
    const cur = cases[currentCaseIndex];
    setAnswers(prev => [...prev, { caseId: cur.case_id, correct: true, attempts: attemptCount, userAnswer: "", feedback }]);
    setCases(prev => prev.map((c, i) => {
      if (i === currentCaseIndex) return { ...c, status: "completed" as const };
      if (i === currentCaseIndex + 1 && c.status === "locked") return { ...c, status: "unlocked" as const };
      return c;
    }));
    setPhase(currentCaseIndex === cases.length - 1 ? "report" : "dashboard");
  }, [cases, currentCaseIndex]);

  const handleRestart = useCallback(() => {
    setPhase("landing"); setTopic(""); setInvestigationTitle(""); setCharacter(null); setCases([]); setCurrentCaseIndex(0); setAnswers([]); setError(null);
  }, []);

  return (
    <div className="min-h-screen relative">
      {/* Layered backgrounds */}
      <div className="bg-mesh" />
      <div className="bg-grid" />
      <div className="bg-scanline" />

      {/* Error toast */}
      {error && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 anim-slideDown">
          <div className="feedback-error flex items-center gap-3 px-5 py-3 shadow-2xl">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></svg>
            <p className="text-sm text-red-200">{error}</p>
            <button onClick={() => setError(null)} className="text-zinc-500 hover:text-white ml-2 text-lg">×</button>
          </div>
        </div>
      )}

      {phase === "landing" && <LandingScreen onStart={handleStart} />}
      {phase === "loading" && <LoadingScreen topic={topic} />}
      {phase === "cinematic" && <CinematicScreen onComplete={() => setPhase("dashboard")} />}
      {phase === "dashboard" && character && <Dashboard topic={topic} investigationTitle={investigationTitle} character={character} cases={cases} onSelectCase={handleSelectCase} />}
      {phase === "case" && character && cases[currentCaseIndex] && (
        <CaseView caseData={cases[currentCaseIndex]} caseIndex={currentCaseIndex} totalCases={cases.length}
          character={character} topic={topic} onSolved={handleCaseSolved} onBack={() => setPhase("dashboard")} />
      )}
      {phase === "report" && character && <ReportScreen topic={topic} investigationTitle={investigationTitle} character={character} cases={cases} answers={answers} onRestart={handleRestart} />}
    </div>
  );
}

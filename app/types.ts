export interface LabItem {
  id: string;
  label: string;
  icon: string;
  type: 'text' | 'image';
}

export interface LabCombination {
  items: [string, string];
  prompt: string;
  clue: string;
}

export interface Evidence {
  type: 'image' | 'video';
  description: string;
  generation_prompt: string;
  hidden_clue: string;
  url?: string;
}

export interface Case {
  case_id: number;
  status: 'locked' | 'unlocked' | 'completed';
  title: string;
  scenario: string;
  character_dialogue: string;
  evidence: Evidence;
  question: string;
  expected_answer: string;
  acceptable_variations: string[];
  terminal_code: string;
  hint: string;
  explanation: string;
  difficulty: string;
  lab_items?: LabItem[];
  lab_combinations?: LabCombination[];
  lab_hint?: string;
  terminal_video_prompt?: string;
  terminal_audio_text?: string;
}

export interface DetectiveCharacter {
  name: string;
  personality: string;
  tone: string;
  expertise: string;
  gender?: 'male' | 'female';
}

export interface CaseAnswer {
  caseId: number;
  correct: boolean;
  attempts: number;
  userAnswer: string;
  feedback: string;
}

export type GamePhase = 'landing' | 'loading' | 'cinematic' | 'dashboard' | 'case' | 'report';

export interface GameState {
  phase: GamePhase;
  topic: string;
  character: DetectiveCharacter | null;
  cases: Case[];
  currentCaseIndex: number;
  answers: CaseAnswer[];
}

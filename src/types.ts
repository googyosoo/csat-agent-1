export interface VocabItem {
  word: string;
  meaning: string;
  pos?: string;
  synonym?: string;
  antonym?: string;
  example?: string;
}

export interface EBSPassage {
  id: string;
  lesson: string;
  itemNo: string;
  type: string;
  title: string;
  passage: string;
  boxSentence?: string;
  summarySentence?: string;
  translation: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  syntaxNotes: string[];
  vocabList: VocabItem[];
}

export interface AgentLog {
  agent: string;
  msg: string;
  timestamp: string;
  glowClass: string;
}

export interface AgentOutputs {
  coreTheme: string;
  logicalFlow: string[];
  keyGrammar: string;
  examinerInsight: string;
  socraticHint: string;
}

export interface DistractorAnalysis {
  optionIndex: number;
  isCorrect: boolean;
  reason: string;
}

export interface GeneratedItem {
  type: string;
  difficulty?: string;
  question: string;
  modifiedPassage: string;
  options: string[];
  correctIndex: number;
  rationale: string;
  distractorAnalysis?: DistractorAnalysis[];
  vocabularyHighlights?: string[];
  syntaxHighlights?: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

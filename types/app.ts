export type UsageMode = 'signing' | 'partner' | null;

export interface ConversationMessage {
  id: string;
  text: string;
  timestamp: number;
  spoken: boolean;
}

export interface RecognitionState {
  serviceStatus: 'connecting' | 'connected' | 'disconnected';
  candidateSign: string | null;
  candidateConfidence: number;
  lastConfirmedSign: string | null;
  activeUtterance: string[];
  autoSpeechEnabled: boolean;
  transcript: ConversationMessage[];
}

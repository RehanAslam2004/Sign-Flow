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

export type ReplyIntent = 'offer_help' | 'confirm' | 'acknowledge' | 'clarify';

export interface SignReferenceEntry {
  id: string;
  phrase: string;
  pslLabel: string;
  intent: ReplyIntent;
  triggerKeywords: string[];
  explanation: string;
  mediaUrl?: string;
  validationStatus: 'verified' | 'pending_verification';
  source: string;
  license: string;
  usageNotes?: string;
  stepByStep?: string[];
}

export interface SuggestedReply {
  id: string;
  text: string;
  intent: ReplyIntent;
  referenceId?: string;
  validationStatus: 'verified' | 'pending_verification';
  reference?: SignReferenceEntry;
}

export interface SuggestRepliesRequest {
  mode: UsageMode;
  messageId: string;
  text: string;
  context?: string[];
}

export interface SuggestRepliesResponse {
  messageId: string;
  suggestions: SuggestedReply[];
  isFallback: boolean;
  notice?: string;
}

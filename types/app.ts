export type UsageMode = 'signing' | 'partner' | null;

export interface ConversationMessage {
  id: string;
  text: string;
  timestamp: number;
  spoken: boolean;
  rawTokens?: string[];
  rawDisplay?: string;
  urduSentence?: string;
  englishSentence?: string;
  isPatternMatched?: boolean;
  averageConfidence?: number;
  alternatives?: string[];
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

export interface SignMotionStep {
  stepNumber: number;
  totalSteps: number;
  label: string;
  instruction: string;
  handPose:
    | 'open_palms_up'
    | 'flat_hand_chest'
    | 'dominant_fist_on_palm'
    | 'point_temple'
    | 'salam_temple'
    | 'open_palm_forward'
    | 'curved_hands_flex';
  motionTrajectory:
    | 'forward_sweep'
    | 'outward_arc'
    | 'upward_lift'
    | 'steady_hold'
    | 'downward_sweep'
    | 'temple_outward_arc';
  motionDescription: string;
}

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
  motionSteps?: SignMotionStep[];
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

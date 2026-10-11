import { SignReferenceEntry, SuggestedReply, ReplyIntent } from '@/types/app';

/**
 * Curated Pakistan Sign Language (PSL) Sign Reference Catalogue
 *
 * Sourced from standard Pakistan Sign Language vocabulary conventions
 * (FESF Deaf Reach & National Institute of Special Education guidelines).
 *
 * NOTE ON VALIDATION STATUS:
 * Where video/animation assets have not yet been produced and reviewed by
 * a certified PSL instructor, validationStatus is set to 'pending_verification'
 * and mediaUrl is omitted. The UI truthfully displays a "Verified sign
 * demonstration not available yet" notice instead of fabricating assets.
 */
export const PSL_REFERENCE_CATALOGUE: SignReferenceEntry[] = [
  {
    id: 'psl_ref_here_you_go',
    phrase: 'Of course. Here you go.',
    pslLabel: 'HERE / TAKE (LE LO)',
    intent: 'offer_help',
    triggerKeywords: ['WATER', 'FOOD', 'NEED', 'PLEASE', 'GIVE'],
    explanation:
      'A courteous offer handing over requested assistance or items (such as water or food).',
    validationStatus: 'pending_verification',
    source: 'Pakistan Sign Language (PSL) standard conversational corpus',
    license: 'CC-BY-4.0 (Community Documentation)',
    usageNotes:
      'Perform with both open palms facing upward, gently extending forward toward your conversation partner with a welcoming facial expression.',
    stepByStep: [
      '1. Start with both hands at chest height, palms open and facing upward.',
      '2. Move both hands smoothly forward toward your partner.',
      '3. Maintain a warm, welcoming nod.',
    ],
  },
  {
    id: 'psl_ref_anything_else',
    phrase: 'Would you like anything else?',
    pslLabel: 'MORE / ANYTHING ELSE (OR KUCH)?',
    intent: 'clarify',
    triggerKeywords: ['WATER', 'FOOD', 'HELP', 'STOP', 'YES'],
    explanation:
      'Inquires whether the person requires additional assistance, refreshments, or clarification.',
    validationStatus: 'pending_verification',
    source: 'Pakistan Sign Language (PSL) standard conversational corpus',
    license: 'CC-BY-4.0 (Community Documentation)',
    usageNotes:
      'Open right hand rotates slightly outward with eyebrows raised to signal a friendly question in PSL.',
    stepByStep: [
      '1. Raise dominant hand with fingers relaxed and palm facing inward.',
      '2. Rotate palm upward and slightly outward.',
      '3. Raise eyebrows slightly to mark the question form.',
    ],
  },
  {
    id: 'psl_ref_thank_you_acknowledge',
    phrase: 'Thank you for telling me.',
    pslLabel: 'SHUKRIYA (THANK YOU)',
    intent: 'acknowledge',
    triggerKeywords: ['WATER', 'FOOD', 'HELP', 'HELLO', 'YES', 'NO', 'STOP'],
    explanation:
      'Politely acknowledges the communicated sign, reassuring the signer that their message was clearly received.',
    validationStatus: 'pending_verification',
    source: 'Pakistan Sign Language (PSL) standard conversational corpus',
    license: 'CC-BY-4.0 (Community Documentation)',
    usageNotes:
      'Flat palm touches chin or chest and extends outward toward the partner with a gentle nod.',
    stepByStep: [
      '1. Place the flat fingertips of your dominant hand lightly near your chin or upper chest.',
      '2. Extend the hand forward and slightly downward toward your partner.',
      '3. Accompany with an acknowledging nod.',
    ],
  },
  {
    id: 'psl_ref_here_to_help',
    phrase: 'I am here to help you.',
    pslLabel: 'MADAD (HELP / SUPPORT)',
    intent: 'offer_help',
    triggerKeywords: ['HELP', 'NEED', 'WATER', 'FOOD'],
    explanation:
      'Assures the signer that you are actively ready to assist with whatever they need.',
    validationStatus: 'pending_verification',
    source: 'Pakistan Sign Language (PSL) standard conversational corpus',
    license: 'CC-BY-4.0 (Community Documentation)',
    usageNotes:
      'Closed dominant fist rests atop flat non-dominant palm, both moving forward together.',
    stepByStep: [
      '1. Place your non-dominant hand flat, palm facing upward.',
      '2. Rest your dominant hand (closed fist with thumb up) atop the flat palm.',
      '3. Lift both hands together slightly forward toward your partner.',
    ],
  },
  {
    id: 'psl_ref_what_do_you_need',
    phrase: 'What do you need?',
    pslLabel: 'KUCH CHAHIYE (WHAT NEED)?',
    intent: 'clarify',
    triggerKeywords: ['HELP', 'WATER', 'FOOD'],
    explanation:
      'Prompts the signer for specific details on how you can assist them.',
    validationStatus: 'pending_verification',
    source: 'Pakistan Sign Language (PSL) standard conversational corpus',
    license: 'CC-BY-4.0 (Community Documentation)',
    usageNotes:
      'Both palms facing up, curved fingers bending slightly downward twice with questioning facial expression.',
    stepByStep: [
      '1. Hold both hands at waist height, palms facing up.',
      '2. Gently curve fingers inward in a repeated flexing motion.',
      '3. Tilt head slightly with inquiring brow.',
    ],
  },
  {
    id: 'psl_ref_please_wait',
    phrase: 'Please wait one moment.',
    pslLabel: 'THOHRA SABAR (WAIT / ONE MOMENT)',
    intent: 'confirm',
    triggerKeywords: ['HELP', 'WATER', 'FOOD', 'STOP'],
    explanation:
      'Politely asks the signer to pause while you retrieve an item, get assistance, or prepare a response.',
    validationStatus: 'pending_verification',
    source: 'Pakistan Sign Language (PSL) standard conversational corpus',
    license: 'CC-BY-4.0 (Community Documentation)',
    usageNotes:
      'Open dominant palm held forward at shoulder level, or index finger raised indicating "one minute".',
    stepByStep: [
      '1. Raise dominant hand gently with palm facing forward at chest level.',
      '2. Keep fingers relaxed together in a calm, non-abrupt gesture.',
      '3. Nod gently to communicate patience and reassurance.',
    ],
  },
  {
    id: 'psl_ref_hello_welcome',
    phrase: 'Hello! Nice to meet you.',
    pslLabel: 'SALAM / HELLO',
    intent: 'acknowledge',
    triggerKeywords: ['HELLO', 'HI'],
    explanation:
      'Traditional respectful greeting in Pakistan Sign Language, conveying warm hospitality.',
    validationStatus: 'pending_verification',
    source: 'Pakistan Sign Language (PSL) standard conversational corpus',
    license: 'CC-BY-4.0 (Community Documentation)',
    usageNotes:
      'Dominant hand touches forehead lightly then extends outward in the traditional Salam sign.',
    stepByStep: [
      '1. Bring dominant open palm near the right temple / forehead.',
      '2. Move the hand outward and forward in a smooth arc toward your partner.',
      '3. Accompany with a warm smile.',
    ],
  },
  {
    id: 'psl_ref_welcome_response',
    phrase: 'You are very welcome.',
    pslLabel: 'KOI BAAT NAHI (WELCOME / NO PROBLEM)',
    intent: 'acknowledge',
    triggerKeywords: ['THANK_YOU', 'THANKS'],
    explanation:
      'A warm response acknowledging gratitude, meaning "no problem" or "you are welcome".',
    validationStatus: 'pending_verification',
    source: 'Pakistan Sign Language (PSL) standard conversational corpus',
    license: 'CC-BY-4.0 (Community Documentation)',
    usageNotes:
      'Open palms sweep gently downward or outward to indicate ease and contentment.',
    stepByStep: [
      '1. Hold hands in front of chest with palms slightly tilted inward.',
      '2. Sweep hands gently downward and outward.',
      '3. Smile warmly.',
    ],
  },
  {
    id: 'psl_ref_understood',
    phrase: 'Understood, thank you.',
    pslLabel: 'SAMJH GAYA (UNDERSTOOD)',
    intent: 'confirm',
    triggerKeywords: ['YES', 'NO', 'STOP', 'HELLO', 'WATER', 'FOOD', 'HELP', 'THANK_YOU'],
    explanation:
      'Confirms that you clearly understood the signed statement and are ready to proceed.',
    validationStatus: 'pending_verification',
    source: 'Pakistan Sign Language (PSL) standard conversational corpus',
    license: 'CC-BY-4.0 (Community Documentation)',
    usageNotes:
      'Index finger taps temple or right hand forms a calm fist with a firm affirmative nod.',
    stepByStep: [
      '1. Dominant hand with index finger touches near temple or forehead.',
      '2. Lower hand smoothly while nodding head affirmatively.',
      '3. Signal clear comprehension and readiness.',
    ],
  },
  {
    id: 'psl_ref_repeat_please',
    phrase: 'Could you please sign that again?',
    pslLabel: 'DOBARA (REPEAT / AGAIN)',
    intent: 'clarify',
    triggerKeywords: ['UNKNOWN', 'UNCLEAR', 'STOP', 'NO'],
    explanation:
      'Politely requests the signer to repeat or clarify the last sign if lighting or framing was unclear.',
    validationStatus: 'pending_verification',
    source: 'Pakistan Sign Language (PSL) standard conversational corpus',
    license: 'CC-BY-4.0 (Community Documentation)',
    usageNotes:
      'Dominant curved hand moves in a small arc toward non-dominant palm signifying "again".',
    stepByStep: [
      '1. Non-dominant hand rests open palm-up in front of chest.',
      '2. Dominant curved hand arches into the palm in a gentle repeating motion.',
      '3. Soft questioning expression requesting a repeat.',
    ],
  },
];

/**
 * Maps incoming recognized sign text to 2–4 contextually ranked suggested replies.
 * Ensures diversity of intent (e.g. offers help, confirms understanding, asks follow-up).
 */
export function getSuggestedRepliesForText(rawText: string): SuggestedReply[] {
  if (!rawText || !rawText.trim()) {
    return [];
  }

  const normalized = rawText.toUpperCase().trim();
  const words = normalized.split(/[\s,._-]+/).filter(Boolean);

  // Score each entry in the catalogue
  const scored = PSL_REFERENCE_CATALOGUE.map((entry) => {
    let score = 0;

    // Direct phrase or keyword matches
    for (const keyword of entry.triggerKeywords) {
      if (normalized.includes(keyword)) {
        score += 3;
      } else if (words.some((w) => w === keyword)) {
        score += 2;
      }
    }

    // Contextual intent bonuses
    if (words.includes('WATER') || words.includes('FOOD')) {
      if (entry.id === 'psl_ref_here_you_go') score += 4;
      if (entry.id === 'psl_ref_anything_else') score += 3;
      if (entry.id === 'psl_ref_please_wait') score += 2;
      if (entry.id === 'psl_ref_thank_you_acknowledge') score += 1;
    } else if (words.includes('HELP')) {
      if (entry.id === 'psl_ref_here_to_help') score += 5;
      if (entry.id === 'psl_ref_what_do_you_need') score += 4;
      if (entry.id === 'psl_ref_please_wait') score += 3;
      if (entry.id === 'psl_ref_understood') score += 2;
    } else if (words.includes('HELLO')) {
      if (entry.id === 'psl_ref_hello_welcome') score += 5;
      if (entry.id === 'psl_ref_here_to_help') score += 3;
      if (entry.id === 'psl_ref_thank_you_acknowledge') score += 2;
    } else if (words.includes('THANK_YOU')) {
      if (entry.id === 'psl_ref_welcome_response') score += 5;
      if (entry.id === 'psl_ref_here_to_help') score += 3;
      if (entry.id === 'psl_ref_understood') score += 2;
    } else if (words.includes('YES') || words.includes('NO')) {
      if (entry.id === 'psl_ref_understood') score += 4;
      if (entry.id === 'psl_ref_anything_else') score += 3;
      if (entry.id === 'psl_ref_thank_you_acknowledge') score += 2;
    } else if (words.includes('STOP')) {
      if (entry.id === 'psl_ref_understood') score += 4;
      if (entry.id === 'psl_ref_anything_else') score += 3;
      if (entry.id === 'psl_ref_repeat_please') score += 2;
    }

    return { entry, score };
  });

  // Filter those with positive relevance
  const matching = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  // If no specific match was found, use standard fallback polite conversational options
  const selectedEntries: SignReferenceEntry[] = [];
  const usedIntents = new Set<ReplyIntent>();

  if (matching.length > 0) {
    // Pick up to 4 diverse entries
    for (const item of matching) {
      if (selectedEntries.length >= 4) break;
      // Allow max 2 with same intent to ensure diversity
      const intentCount = selectedEntries.filter((e) => e.intent === item.entry.intent).length;
      if (intentCount < 2) {
        selectedEntries.push(item.entry);
        usedIntents.add(item.entry.intent);
      }
    }
  }

  // Fallback defaults if fewer than 2 responses were selected
  if (selectedEntries.length < 2) {
    const fallbackIds = [
      'psl_ref_understood',
      'psl_ref_here_to_help',
      'psl_ref_repeat_please',
    ];
    for (const id of fallbackIds) {
      if (selectedEntries.length >= 3) break;
      const found = PSL_REFERENCE_CATALOGUE.find((e) => e.id === id);
      if (found && !selectedEntries.some((e) => e.id === found.id)) {
        selectedEntries.push(found);
      }
    }
  }

  // Format into SuggestedReply records
  return selectedEntries.slice(0, 4).map((entry) => ({
    id: `reply_${entry.id}`,
    text: entry.phrase,
    intent: entry.intent,
    referenceId: entry.id,
    validationStatus: entry.validationStatus,
    reference: entry,
  }));
}

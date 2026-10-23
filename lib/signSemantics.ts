/**
 * SignFlow Semantic Sign Categorization & Boundary Detection
 *
 * Maps every recognized sign label to a semantic category, enabling:
 * 1. Intelligent sentence boundary detection (category transitions)
 * 2. Grammar rule matching (category-aware templates)
 * 3. Contextual disambiguation
 */

export type SignCategory =
  | 'greeting'
  | 'farewell'
  | 'question'
  | 'pronoun'
  | 'verb'
  | 'adjective'
  | 'expression'
  | 'noun'
  | 'time'
  | 'alphabet'
  | 'figure'
  | 'feeling'
  | 'unknown';

/**
 * Complete category map for all PSL Extended (89-class), PSL Words (12-class),
 * PSL Alphabets (37-class), and ASL labels.
 */
const SIGN_CATEGORY_MAP: Record<string, SignCategory> = {
  // === Greetings & Courtesies ===
  'Assalamulaikum': 'greeting',
  'Walaikumasalam': 'greeting',
  'Barai Mehrbani': 'expression',   // "Please" — functions as a polite expression

  // === Affirmations & Negations ===
  'G Han': 'expression',            // "Yes"
  'Nahi hai': 'expression',         // "No"
  'Yaqeen': 'expression',           // "Trust / Believe"

  // === Questions ===
  'Kab': 'question',                // "When"
  'Kesay': 'question',              // "How"
  'Kya qeemat hai': 'question',     // "What is the price?"

  // === Pronouns ===
  'Ap': 'pronoun',                  // "You" (formal)
  'Apki': 'pronoun',                // "Yours"
  'Iski': 'pronoun',                // "His/Hers/Its"
  'Mujhay': 'pronoun',             // "Me"
  'Ye': 'pronoun',                  // "This"

  // === Verbs / Actions ===
  'Jao': 'verb',                    // "Go"
  'Samjhna': 'verb',                // "Understand"
  'Seekh raha hun': 'verb',         // "I am learning"
  'Shirt dhona hai': 'verb',        // "Need to wash shirt" (action phrase)

  // === Adjectives / States ===
  'Behra': 'adjective',             // "Deaf"
  'Bemar': 'adjective',             // "Sick"
  'Dur hai': 'adjective',           // "Far away"

  // === Nouns ===
  'Bachay': 'noun',                 // "Children"
  'Email Address': 'noun',
  'Hain': 'verb',                   // "Are" (auxiliary)

  // === Time ===
  'Aj': 'time',                     // "Today"
  'Baad may': 'time',               // "Later"

  // === Feelings ===
  'Mahsoos kar rahay': 'feeling',   // "Feeling"

  // === Fruits ===
  'APPLE': 'noun',
  'Cherry': 'noun',
  'Fig': 'noun',
  'Guava': 'noun',
  'Peach': 'noun',
  'Pineapple': 'noun',
  'Watermelon': 'noun',

  // === Animals / Birds ===
  'Duck': 'noun',
  'Eagle': 'noun',
  'Falcon': 'noun',
  'Penguin': 'noun',
  'Pigeon': 'noun',
  'Woodpecker': 'noun',
  'Cuckoo': 'noun',
  'owl': 'noun',
  'parrot': 'noun',

  // === Historical & Cultural Figures ===
  'Allah': 'figure',
  'Allama Iqbal': 'figure',
  'Muhammad Ali Jinnah': 'figure',
  'Muhammad Bin Qasim': 'figure',
  'Zulfiqar Ali Bhutto': 'figure',
  'Mahatma Gandhi': 'figure',
  'Lord Mountbatten': 'figure',
  'Sikander-e-Azam': 'figure',
  'Firaun': 'figure',
  'Genghis Khan': 'figure',

  // === Urdu Alphabet (PSL Extended romanized labels) ===
  'Alif': 'alphabet',
  'Bay': 'alphabet',
  'Pay': 'alphabet',
  'Tay': 'alphabet',
  'Ttay': 'alphabet',
  'Say': 'alphabet',
  'Jeem': 'alphabet',
  'Chay': 'alphabet',
  'Hay': 'alphabet',
  'Khay': 'alphabet',
  'Dal': 'alphabet',
  'Ddal': 'alphabet',
  'Zal': 'alphabet',
  'Ray': 'alphabet',
  'rray': 'alphabet',
  'zay': 'alphabet',
  'seen': 'alphabet',
  'Sheen': 'alphabet',
  'suaad': 'alphabet',
  'Zuaad': 'alphabet',
  'Toain': 'alphabet',
  'Zoain': 'alphabet',
  'Ain': 'alphabet',
  'Ghain': 'alphabet',
  'Fay': 'alphabet',
  'Qaaf': 'alphabet',
  'Kaaf': 'alphabet',
  'Gaaf': 'alphabet',
  'Laam': 'alphabet',
  'Meem': 'alphabet',
  'Noon': 'alphabet',
  'Wao': 'alphabet',
  'He': 'alphabet',
  'Hamza': 'alphabet',
  'Choti-ye': 'alphabet',
  'bari-ye': 'alphabet',

  // === Urdu Alphabet (Unicode characters from PSL Alphabets model) ===
  'ا': 'alphabet', 'ب': 'alphabet', 'پ': 'alphabet', 'ت': 'alphabet',
  'ٹ': 'alphabet', 'ث': 'alphabet', 'ج': 'alphabet', 'چ': 'alphabet',
  'ح': 'alphabet', 'خ': 'alphabet', 'د': 'alphabet', 'ڈ': 'alphabet',
  'ذ': 'alphabet', 'ر': 'alphabet', 'ڑ': 'alphabet', 'ز': 'alphabet',
  'ژ': 'alphabet', 'س': 'alphabet', 'ش': 'alphabet', 'ص': 'alphabet',
  'ض': 'alphabet', 'ط': 'alphabet', 'ظ': 'alphabet', 'ع': 'alphabet',
  'غ': 'alphabet', 'ف': 'alphabet', 'ق': 'alphabet', 'ک': 'alphabet',
  'گ': 'alphabet', 'ل': 'alphabet', 'م': 'alphabet', 'ن': 'alphabet',
  'و': 'alphabet', 'ہ': 'alphabet', 'ء': 'alphabet', 'ی': 'alphabet',
  'ے': 'alphabet',

  // === PSL Words (12-class) ===
  'THANKS': 'expression',
  'EAT': 'verb',
  'GOOD': 'adjective',
  'MY': 'pronoun',
  'YOU': 'pronoun',
  'YOUR': 'pronoun',
  'NAME': 'noun',
  'ME': 'pronoun',
  'I': 'pronoun',
  'THIS': 'pronoun',
  'WHAT': 'question',
  'LITTLE': 'adjective',
  'KNOW': 'verb',
  'PHONE': 'noun',

  // === ASL common labels ===
  'HELLO': 'greeting',
  'YES': 'expression',
  'NO': 'expression',
  'HELP': 'verb',
  'WATER': 'noun',
  'FOOD': 'noun',
  'STOP': 'expression',
  'PLEASE': 'expression',
  'THANK_YOU': 'expression',
};

// ASL single letters and digits → alphabet
for (let i = 0; i <= 9; i++) {
  SIGN_CATEGORY_MAP[String(i)] = 'alphabet';
}
for (let c = 65; c <= 90; c++) {
  SIGN_CATEGORY_MAP[String.fromCharCode(c)] = 'alphabet';
}

/**
 * Returns the semantic category of a recognized sign label.
 */
export function getSignCategory(sign: string): SignCategory {
  if (!sign) return 'unknown';

  // Direct lookup (case-sensitive first for exact PSL labels)
  if (SIGN_CATEGORY_MAP[sign] !== undefined) {
    return SIGN_CATEGORY_MAP[sign];
  }

  // Case-insensitive fallback
  const upper = sign.toUpperCase();
  for (const [key, cat] of Object.entries(SIGN_CATEGORY_MAP)) {
    if (key.toUpperCase() === upper) return cat;
  }

  // Single character → likely alphabet/fingerspelling
  if (sign.length === 1) return 'alphabet';

  return 'unknown';
}

/**
 * Sentence boundary transition pairs.
 * When a sign of category `from` is followed by a sign of category `to`,
 * the current utterance should be flushed before committing the new sign.
 */
const BOUNDARY_TRANSITIONS: Array<[SignCategory, SignCategory]> = [
  // New conversational turn starting
  ['expression', 'greeting'],
  ['question', 'greeting'],
  ['verb', 'greeting'],
  ['noun', 'greeting'],
  ['adjective', 'greeting'],
  ['feeling', 'greeting'],
  ['figure', 'greeting'],

  // Greeting completed, question begins
  ['greeting', 'question'],

  // Question answered, new topic
  ['question', 'expression'],

  // Statement completed, farewell
  ['verb', 'farewell'],
  ['expression', 'farewell'],
  ['noun', 'farewell'],

  // Category-switch boundary signals
  ['figure', 'question'],
  ['figure', 'verb'],
  ['feeling', 'greeting'],
  ['feeling', 'question'],

  // Alphabet → non-alphabet (fingerspelling ended, new semantic unit)
  ['alphabet', 'greeting'],
  ['alphabet', 'question'],
  ['alphabet', 'verb'],
  ['alphabet', 'expression'],
  ['alphabet', 'figure'],
];

/**
 * Determines if transitioning from `prevCategory` to `nextCategory`
 * represents a sentence boundary (should auto-flush the current utterance).
 */
export function isBoundaryTransition(
  prevCategory: SignCategory,
  nextCategory: SignCategory
): boolean {
  if (prevCategory === 'unknown' || nextCategory === 'unknown') return false;
  if (prevCategory === nextCategory) return false;

  return BOUNDARY_TRANSITIONS.some(
    ([from, to]) => from === prevCategory && to === nextCategory
  );
}

/**
 * Checks if a sign category is part of fingerspelling (individual letters/digits).
 */
export function isAlphabetCategory(category: SignCategory): boolean {
  return category === 'alphabet';
}

/**
 * SignFlow Grammar Engine
 *
 * Transforms sequences of recognized sign tokens into natural Urdu and English
 * sentences using pattern-matching grammar rules. Fully offline, deterministic,
 * zero external dependencies.
 *
 * Strategy:
 * 1. Try longest-matching pattern rules first (greedy)
 * 2. Fall back to category-based template composition
 * 3. Final fallback: contextual concatenation with connectors
 */

import { getSignCategory, SignCategory, isAlphabetCategory } from './signSemantics';
import { PSL_EXTENDED_MAP, URDU_ALPHABET_MAP } from './urduMapping';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SentenceResult {
  rawTokens: string[];
  urdu: string;
  english: string;
  isPatternMatched: boolean;
}

interface GrammarRule {
  id: string;
  /** Token patterns to match. '*' matches any single token. '...' matches one or more. */
  pattern: string[];
  urduTemplate: string;
  englishTemplate: string;
  priority: number;
}

// ---------------------------------------------------------------------------
// Pattern Rules (highest priority = checked first)
// ---------------------------------------------------------------------------

const GRAMMAR_RULES: GrammarRule[] = [
  // === Multi-token greeting + question combos ===
  {
    id: 'greeting_how_feeling',
    pattern: ['Assalamulaikum', 'Ap', 'Kesay', 'Mahsoos kar rahay'],
    urduTemplate: 'السلام علیکم، آپ کیسے محسوس کر رہے ہیں؟',
    englishTemplate: 'Hello, how are you feeling?',
    priority: 100,
  },
  {
    id: 'greeting_how',
    pattern: ['Assalamulaikum', 'Ap', 'Kesay'],
    urduTemplate: 'السلام علیکم، آپ کیسے ہیں؟',
    englishTemplate: 'Hello, how are you?',
    priority: 95,
  },
  {
    id: 'greeting_how_alt',
    pattern: ['Assalamulaikum', 'Kesay'],
    urduTemplate: 'السلام علیکم، کیسے ہیں؟',
    englishTemplate: 'Hello, how are you?',
    priority: 90,
  },
  {
    id: 'greeting_reply_fine',
    pattern: ['Walaikumasalam', 'G Han'],
    urduTemplate: 'وعلیکم السلام، جی ہاں ٹھیک ہوں',
    englishTemplate: 'Peace be upon you too, yes I am fine',
    priority: 90,
  },
  {
    id: 'please_help',
    pattern: ['Barai Mehrbani', 'HELP'],
    urduTemplate: 'برائے مہربانی مدد کریں',
    englishTemplate: 'Please help',
    priority: 88,
  },

  // === Pronoun + feeling/state ===
  {
    id: 'i_am_learning',
    pattern: ['Mujhay', 'Seekh raha hun'],
    urduTemplate: 'میں سیکھ رہا ہوں',
    englishTemplate: 'I am learning',
    priority: 85,
  },
  {
    id: 'i_am_sick',
    pattern: ['Mujhay', 'Bemar'],
    urduTemplate: 'میں بیمار ہوں',
    englishTemplate: 'I am sick',
    priority: 85,
  },
  {
    id: 'you_understand',
    pattern: ['Ap', 'Samjhna'],
    urduTemplate: 'آپ سمجھ رہے ہیں؟',
    englishTemplate: 'Do you understand?',
    priority: 82,
  },
  {
    id: 'you_feeling',
    pattern: ['Ap', 'Mahsoos kar rahay'],
    urduTemplate: 'آپ کیسا محسوس کر رہے ہیں؟',
    englishTemplate: 'How are you feeling?',
    priority: 82,
  },
  {
    id: 'this_far',
    pattern: ['Ye', 'Dur hai'],
    urduTemplate: 'یہ دور ہے',
    englishTemplate: 'This is far away',
    priority: 80,
  },
  {
    id: 'children_go',
    pattern: ['Bachay', 'Jao'],
    urduTemplate: 'بچے جاؤ',
    englishTemplate: 'Children, go',
    priority: 80,
  },
  {
    id: 'come_later',
    pattern: ['Baad may', 'Jao'],
    urduTemplate: 'بعد میں جاؤ',
    englishTemplate: 'Go later',
    priority: 80,
  },
  {
    id: 'today_come',
    pattern: ['Aj', 'Jao'],
    urduTemplate: 'آج جاؤ',
    englishTemplate: 'Go today',
    priority: 80,
  },

  // === Pronoun + question ===
  {
    id: 'you_when',
    pattern: ['Ap', 'Kab'],
    urduTemplate: 'آپ کب؟',
    englishTemplate: 'When (for you)?',
    priority: 78,
  },
  {
    id: 'you_how',
    pattern: ['Ap', 'Kesay'],
    urduTemplate: 'آپ کیسے؟',
    englishTemplate: 'How (for you)?',
    priority: 78,
  },
  {
    id: 'this_price',
    pattern: ['Ye', 'Kya qeemat hai'],
    urduTemplate: 'یہ کیا قیمت ہے؟',
    englishTemplate: 'What is the price of this?',
    priority: 78,
  },

  // === PSL Words combos ===
  {
    id: 'my_name',
    pattern: ['MY', 'NAME'],
    urduTemplate: 'میرا نام',
    englishTemplate: 'My name',
    priority: 75,
  },
  {
    id: 'your_name_what',
    pattern: ['YOUR', 'NAME', 'WHAT'],
    urduTemplate: 'آپ کا نام کیا ہے؟',
    englishTemplate: 'What is your name?',
    priority: 85,
  },
  {
    id: 'your_name',
    pattern: ['YOUR', 'NAME'],
    urduTemplate: 'آپ کا نام',
    englishTemplate: 'Your name',
    priority: 75,
  },
  {
    id: 'you_eat',
    pattern: ['YOU', 'EAT'],
    urduTemplate: 'آپ کھانا کھائیں',
    englishTemplate: 'You eat',
    priority: 72,
  },
  {
    id: 'me_eat',
    pattern: ['ME', 'EAT'],
    urduTemplate: 'میں کھانا کھاتا ہوں',
    englishTemplate: 'I eat',
    priority: 72,
  },
  {
    id: 'you_know',
    pattern: ['YOU', 'KNOW'],
    urduTemplate: 'آپ جانتے ہیں',
    englishTemplate: 'You know',
    priority: 72,
  },
  {
    id: 'my_phone',
    pattern: ['MY', 'PHONE'],
    urduTemplate: 'میرا فون',
    englishTemplate: 'My phone',
    priority: 72,
  },
  {
    id: 'your_phone',
    pattern: ['YOUR', 'PHONE'],
    urduTemplate: 'آپ کا فون',
    englishTemplate: 'Your phone',
    priority: 72,
  },
  {
    id: 'little_good',
    pattern: ['LITTLE', 'GOOD'],
    urduTemplate: 'تھوڑا اچھا',
    englishTemplate: 'A little good',
    priority: 70,
  },
  {
    id: 'good_thanks',
    pattern: ['GOOD', 'THANKS'],
    urduTemplate: 'اچھا ہے، شکریہ',
    englishTemplate: 'Good, thanks',
    priority: 70,
  },
  {
    id: 'what_name',
    pattern: ['WHAT', 'NAME'],
    urduTemplate: 'نام کیا ہے؟',
    englishTemplate: 'What is the name?',
    priority: 72,
  },

  // === Deictic Pointing & Cross-Vocabulary Pronoun Combos ===
  {
    id: 'you_how_en',
    pattern: ['YOU', 'Kesay'],
    urduTemplate: 'آپ کیسے ہیں؟',
    englishTemplate: 'How are you?',
    priority: 85,
  },
  {
    id: 'me_sick_en',
    pattern: ['ME', 'Bemar'],
    urduTemplate: 'میں بیمار ہوں',
    englishTemplate: 'I am sick',
    priority: 85,
  },
  {
    id: 'me_learning_en',
    pattern: ['ME', 'Seekh raha hun'],
    urduTemplate: 'میں سیکھ رہا ہوں',
    englishTemplate: 'I am learning',
    priority: 85,
  },
  {
    id: 'you_understand_en',
    pattern: ['YOU', 'Samjhna'],
    urduTemplate: 'کیا آپ سمجھ رہے ہیں؟',
    englishTemplate: 'Do you understand?',
    priority: 82,
  },
  {
    id: 'me_understand',
    pattern: ['Mujhay', 'Samjhna'],
    urduTemplate: 'میں سمجھ رہا ہوں',
    englishTemplate: 'I understand',
    priority: 82,
  },
  {
    id: 'me_understand_en',
    pattern: ['ME', 'Samjhna'],
    urduTemplate: 'میں سمجھ رہا ہوں',
    englishTemplate: 'I understand',
    priority: 82,
  },
  {
    id: 'you_feeling_en',
    pattern: ['YOU', 'Mahsoos kar rahay'],
    urduTemplate: 'آپ کیسا محسوس کر رہے ہیں؟',
    englishTemplate: 'How are you feeling?',
    priority: 82,
  },
  {
    id: 'this_price_en',
    pattern: ['THIS', 'Kya qeemat hai'],
    urduTemplate: 'اس کی کیا قیمت ہے؟',
    englishTemplate: 'What is the price of this?',
    priority: 80,
  },
  {
    id: 'this_far_en',
    pattern: ['THIS', 'Dur hai'],
    urduTemplate: 'یہ دور ہے',
    englishTemplate: 'This is far away',
    priority: 80,
  },
  {
    id: 'ap_eat',
    pattern: ['Ap', 'EAT'],
    urduTemplate: 'آپ کھانا کھائیں',
    englishTemplate: 'You eat',
    priority: 75,
  },
  {
    id: 'mujhay_eat',
    pattern: ['Mujhay', 'EAT'],
    urduTemplate: 'مجھے کھانا کھانا ہے',
    englishTemplate: 'I need to eat',
    priority: 75,
  },
  {
    id: 'ap_know',
    pattern: ['Ap', 'KNOW'],
    urduTemplate: 'آپ جانتے ہیں',
    englishTemplate: 'You know',
    priority: 75,
  },
  {
    id: 'mujhay_know',
    pattern: ['Mujhay', 'KNOW'],
    urduTemplate: 'میں جانتا ہوں',
    englishTemplate: 'I know',
    priority: 75,
  },
  {
    id: 'ap_name',
    pattern: ['Ap', 'NAME'],
    urduTemplate: 'آپ کا نام',
    englishTemplate: 'Your name',
    priority: 75,
  },
  {
    id: 'mujhay_name',
    pattern: ['Mujhay', 'NAME'],
    urduTemplate: 'میرا نام',
    englishTemplate: 'My name',
    priority: 75,
  },
  {
    id: 'greeting_you_how',
    pattern: ['Assalamulaikum', 'YOU', 'Kesay'],
    urduTemplate: 'السلام علیکم، آپ کیسے ہیں؟',
    englishTemplate: 'Hello, how are you?',
    priority: 95,
  },

  // === Single-token rules (lowest priority, used when no multi-token matches) ===
  // These are handled by the fallback system, not explicit rules
].sort((a, b) => b.priority - a.priority);

// ---------------------------------------------------------------------------
// Single-Sign Sentence Map (for standalone signs)
// ---------------------------------------------------------------------------

const STANDALONE_SENTENCES: Record<string, { urdu: string; english: string }> = {
  'Assalamulaikum': { urdu: 'السلام علیکم', english: 'Peace be upon you' },
  'Walaikumasalam': { urdu: 'وعلیکم السلام', english: 'And peace be upon you too' },
  'Barai Mehrbani': { urdu: 'برائے مہربانی', english: 'Please' },
  'G Han': { urdu: 'جی ہاں', english: 'Yes' },
  'Nahi hai': { urdu: 'نہیں', english: 'No' },
  'Kab': { urdu: 'کب؟', english: 'When?' },
  'Kesay': { urdu: 'کیسے؟', english: 'How?' },
  'Kya qeemat hai': { urdu: 'کیا قیمت ہے؟', english: 'What is the price?' },
  'Jao': { urdu: 'جاؤ', english: 'Go' },
  'Samjhna': { urdu: 'سمجھ لیں', english: 'Understand' },
  'Seekh raha hun': { urdu: 'میں سیکھ رہا ہوں', english: 'I am learning' },
  'Shirt dhona hai': { urdu: 'شرٹ دھونا ہے', english: 'Need to wash shirt' },
  'Bemar': { urdu: 'بیمار ہے', english: 'Sick' },
  'Dur hai': { urdu: 'دور ہے', english: 'It is far' },
  'Mahsoos kar rahay': { urdu: 'محسوس کر رہے ہیں', english: 'Feeling' },
  'Yaqeen': { urdu: 'یقین کریں', english: 'Trust / Believe' },
  'Aj': { urdu: 'آج', english: 'Today' },
  'Baad may': { urdu: 'بعد میں', english: 'Later' },
  'Bachay': { urdu: 'بچے', english: 'Children' },

  // Deictic Pronouns
  'Ap': { urdu: 'آپ', english: 'You' },
  'Mujhay': { urdu: 'مجھے', english: 'Me' },
  'Ye': { urdu: 'یہ', english: 'This' },
  'THIS': { urdu: 'یہ', english: 'This' },
  'Apki': { urdu: 'آپ کی', english: 'Yours' },
  'Iski': { urdu: 'اس کی', english: 'His / Hers / Its' },

  // PSL Words (12-class)
  'THANKS': { urdu: 'شکریہ', english: 'Thank you' },
  'EAT': { urdu: 'کھانا', english: 'Eat / Food' },
  'GOOD': { urdu: 'اچھا', english: 'Good' },
  'MY': { urdu: 'میرا', english: 'My' },
  'YOU': { urdu: 'آپ', english: 'You' },
  'YOUR': { urdu: 'آپ کا', english: 'Your' },
  'NAME': { urdu: 'نام', english: 'Name' },
  'ME': { urdu: 'مجھے', english: 'Me' },
  'WHAT': { urdu: 'کیا؟', english: 'What?' },
  'LITTLE': { urdu: 'تھوڑا', english: 'Little' },
  'KNOW': { urdu: 'جانتا ہوں', english: 'Know' },
  'PHONE': { urdu: 'فون', english: 'Phone' },

  // ASL basics
  'HELLO': { urdu: 'ہیلو', english: 'Hello' },
  'YES': { urdu: 'ہاں', english: 'Yes' },
  'NO': { urdu: 'نہیں', english: 'No' },
  'HELP': { urdu: 'مدد', english: 'Help' },
  'WATER': { urdu: 'پانی', english: 'Water' },
  'FOOD': { urdu: 'کھانا', english: 'Food' },
  'STOP': { urdu: 'رکیں', english: 'Stop' },
  'PLEASE': { urdu: 'برائے مہربانی', english: 'Please' },
  'THANK_YOU': { urdu: 'شکریہ', english: 'Thank you' },
};

// ---------------------------------------------------------------------------
// Core Engine
// ---------------------------------------------------------------------------

/**
 * Attempts to match a token sequence against the grammar rules.
 * Uses greedy longest-match strategy.
 */
function matchPattern(tokens: string[]): GrammarRule | null {
  // Rules are pre-sorted by priority (highest first)
  for (const rule of GRAMMAR_RULES) {
    if (rule.pattern.length !== tokens.length) continue;

    let matches = true;
    for (let i = 0; i < rule.pattern.length; i++) {
      const patternToken = rule.pattern[i];
      const inputToken = tokens[i];

      if (patternToken === '*') continue; // wildcard
      if (patternToken.toUpperCase() !== inputToken.toUpperCase()) {
        // Also try case-sensitive exact match for PSL labels
        if (patternToken !== inputToken) {
          matches = false;
          break;
        }
      }
    }

    if (matches) return rule;
  }

  return null;
}

/**
 * Attempts partial/subsequence matching for longer token arrays.
 * Finds the longest matching sub-sequence and formats around it.
 */
function matchPartialPatterns(tokens: string[]): SentenceResult | null {
  if (tokens.length < 2) return null;

  // Try all contiguous sub-sequences from longest to shortest
  for (let len = Math.min(tokens.length, 6); len >= 2; len--) {
    for (let start = 0; start <= tokens.length - len; start++) {
      const subTokens = tokens.slice(start, start + len);
      const rule = matchPattern(subTokens);

      if (rule) {
        // Build sentence from: prefix tokens + matched pattern + suffix tokens
        const prefixTokens = tokens.slice(0, start);
        const suffixTokens = tokens.slice(start + len);

        const parts: { urdu: string; english: string }[] = [];

        if (prefixTokens.length > 0) {
          const prefixResult = buildFallbackSentence(prefixTokens);
          parts.push({ urdu: prefixResult.urdu, english: prefixResult.english });
        }

        parts.push({ urdu: rule.urduTemplate, english: rule.englishTemplate });

        if (suffixTokens.length > 0) {
          const suffixResult = buildFallbackSentence(suffixTokens);
          parts.push({ urdu: suffixResult.urdu, english: suffixResult.english });
        }

        return {
          rawTokens: tokens,
          urdu: parts.map((p) => p.urdu).join('، '),
          english: parts.map((p) => p.english).join(', '),
          isPatternMatched: true,
        };
      }
    }
  }

  return null;
}

/**
 * Concatenates fingerspelling alphabet tokens into a word attempt.
 */
function joinAlphabetTokens(tokens: string[]): string {
  return tokens
    .map((t) => {
      // For Urdu alphabet romanized names, extract the letter
      if (PSL_EXTENDED_MAP[t]) return PSL_EXTENDED_MAP[t].char;
      if (URDU_ALPHABET_MAP[t]) return URDU_ALPHABET_MAP[t].char;
      // For single-character tokens (ASL letters/digits)
      if (t.length === 1) return t;
      return t;
    })
    .join('');
}

/**
 * Builds a fallback sentence using category-based templates
 * when no exact pattern rule matches.
 */
function buildFallbackSentence(tokens: string[]): { urdu: string; english: string } {
  if (tokens.length === 0) return { urdu: '', english: '' };

  // Check if all tokens are alphabet → fingerspelling
  const categories = tokens.map((t) => getSignCategory(t));
  const allAlphabet = categories.every((c) => isAlphabetCategory(c));

  if (allAlphabet) {
    const spelled = joinAlphabetTokens(tokens);
    return { urdu: spelled, english: spelled };
  }

  // --- Category-based compositions ---
  if (tokens.length === 2) {
    const [c1, c2] = categories;

    // [Mujhay, *noun] -> "I need {noun}" / "مجھے {noun} چاہیے"
    if (tokens[0] === 'Mujhay' && c2 === 'noun') {
      const nounInfo = PSL_EXTENDED_MAP[tokens[1]];
      const urduNoun = nounInfo?.char || tokens[1];
      const engNoun = nounInfo?.name || tokens[1];
      return {
        urdu: `مجھے ${urduNoun} چاہیے`,
        english: `I need ${engNoun}`,
      };
    }

    // [greeting, question] -> "{greeting}, {question}?"
    if (c1 === 'greeting' && c2 === 'question') {
      const gStandalone = STANDALONE_SENTENCES[tokens[0]];
      const qStandalone = STANDALONE_SENTENCES[tokens[1]];
      const gUrdu = gStandalone?.urdu || tokens[0];
      const qUrdu = qStandalone?.urdu || tokens[1];
      const gEng = gStandalone?.english || tokens[0];
      const qEng = qStandalone?.english || tokens[1];
      return {
        urdu: `${gUrdu}، ${qUrdu}`,
        english: `${gEng}, ${qEng}`,
      };
    }

    // [pronoun, verb] -> "{pronoun} {verb}"
    if (c1 === 'pronoun' && c2 === 'verb') {
      const pInfo = PSL_EXTENDED_MAP[tokens[0]];
      const vInfo = PSL_EXTENDED_MAP[tokens[1]];
      const pUrdu = pInfo?.char || tokens[0];
      const vUrdu = vInfo?.char || tokens[1];
      const pEng = pInfo?.name || tokens[0];
      const vEng = vInfo?.name || tokens[1];
      return {
        urdu: `${pUrdu} ${vUrdu}`,
        english: `${pEng} ${vEng}`,
      };
    }

    // [Ap, *noun] -> "آپ کا {noun}" / "Your {noun}"
    if (tokens[0] === 'Ap' && c2 === 'noun') {
      const nInfo = PSL_EXTENDED_MAP[tokens[1]];
      const nUrdu = nInfo?.char || tokens[1];
      const nEng = nInfo?.name || tokens[1];
      return {
        urdu: `آپ کا ${nUrdu}`,
        english: `Your ${nEng}`,
      };
    }
  }

  if (tokens.length === 3) {
    // [Ap, *noun, question] -> "آپ کا {noun} کیسا ہے؟" / "How is your {noun}?"
    if (tokens[0] === 'Ap' && categories[1] === 'noun' && categories[2] === 'question') {
      const nInfo = PSL_EXTENDED_MAP[tokens[1]];
      const nUrdu = nInfo?.char || tokens[1];
      const nEng = nInfo?.name || tokens[1];
      return {
        urdu: `آپ کا ${nUrdu} کیسا ہے؟`,
        english: `How is your ${nEng}?`,
      };
    }
  }

  // Group consecutive alphabets, leave others as individual tokens
  const segments: Array<{ type: 'word' | 'alpha'; tokens: string[] }> = [];
  let currentAlphas: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    if (isAlphabetCategory(categories[i])) {
      currentAlphas.push(tokens[i]);
    } else {
      if (currentAlphas.length > 0) {
        segments.push({ type: 'alpha', tokens: [...currentAlphas] });
        currentAlphas = [];
      }
      segments.push({ type: 'word', tokens: [tokens[i]] });
    }
  }
  if (currentAlphas.length > 0) {
    segments.push({ type: 'alpha', tokens: currentAlphas });
  }

  // Build sentence from segments
  const urduParts: string[] = [];
  const englishParts: string[] = [];

  for (const seg of segments) {
    if (seg.type === 'alpha') {
      const spelled = joinAlphabetTokens(seg.tokens);
      urduParts.push(spelled);
      englishParts.push(spelled);
    } else {
      const token = seg.tokens[0];
      const standalone = STANDALONE_SENTENCES[token];
      if (standalone) {
        urduParts.push(standalone.urdu);
        englishParts.push(standalone.english);
      } else if (PSL_EXTENDED_MAP[token]) {
        urduParts.push(PSL_EXTENDED_MAP[token].char);
        englishParts.push(PSL_EXTENDED_MAP[token].name);
      } else {
        // Use the raw token as-is
        urduParts.push(token);
        englishParts.push(token);
      }
    }
  }

  // Add question mark if last category is a question
  const lastCat = categories[categories.length - 1];
  let urdu = urduParts.join(' ');
  let english = englishParts.join(' ');

  if (lastCat === 'question') {
    if (!urdu.endsWith('؟')) urdu += '؟';
    if (!english.endsWith('?')) english += '?';
  }

  return { urdu, english };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transforms an array of confirmed sign tokens into a natural bilingual sentence.
 *
 * @param tokens - Array of confirmed sign labels (e.g., ['Assalamulaikum', 'Ap', 'Kesay'])
 * @returns Structured sentence result with Urdu, English, and metadata
 */
export function buildSentence(tokens: string[]): SentenceResult {
  if (!tokens || tokens.length === 0) {
    return { rawTokens: [], urdu: '', english: '', isPatternMatched: false };
  }

  // 1. Try exact full-sequence pattern match
  const exactRule = matchPattern(tokens);
  if (exactRule) {
    return {
      rawTokens: tokens,
      urdu: exactRule.urduTemplate,
      english: exactRule.englishTemplate,
      isPatternMatched: true,
    };
  }

  // 2. Try partial/subsequence matching for longer sequences
  if (tokens.length >= 2) {
    const partial = matchPartialPatterns(tokens);
    if (partial) return partial;
  }

  // 3. Single token → standalone sentence lookup
  if (tokens.length === 1) {
    const standalone = STANDALONE_SENTENCES[tokens[0]];
    if (standalone) {
      return {
        rawTokens: tokens,
        urdu: standalone.urdu,
        english: standalone.english,
        isPatternMatched: true,
      };
    }

    // Figures get their bilingual name
    if (PSL_EXTENDED_MAP[tokens[0]]) {
      const info = PSL_EXTENDED_MAP[tokens[0]];
      return {
        rawTokens: tokens,
        urdu: info.char,
        english: info.name,
        isPatternMatched: true,
      };
    }
  }

  // 4. Category-based fallback composition
  const fallback = buildFallbackSentence(tokens);
  return {
    rawTokens: tokens,
    urdu: fallback.urdu,
    english: fallback.english,
    isPatternMatched: false,
  };
}

/**
 * Generates a live preview sentence for partially accumulated tokens.
 * Used for the "Current Translation" display during signing.
 */
export function buildPreviewSentence(tokens: string[]): SentenceResult {
  return buildSentence(tokens);
}

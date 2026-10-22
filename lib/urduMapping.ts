/**
 * SignFlow Urdu Alphabet Phonetic & Romanization Mapping
 * Provides verified romanized pronunciation and display formatting for
 * the 37 Pakistan Sign Language Urdu Alphabet characters.
 */

export interface UrduLetterInfo {
  char: string;
  name: string;
  pronunciation: string;
}

export const URDU_ALPHABET_MAP: Record<string, UrduLetterInfo> = {
  'ا': { char: 'ا', name: 'Alif', pronunciation: 'Alif' },
  'ب': { char: 'ب', name: 'Bay', pronunciation: 'Bay' },
  'پ': { char: 'پ', name: 'Pay', pronunciation: 'Pay' },
  'ت': { char: 'ت', name: 'Tay', pronunciation: 'Tay' },
  'ٹ': { char: 'ٹ', name: 'Ttay', pronunciation: 'Ttay' },
  'ث': { char: 'ث', name: 'Say', pronunciation: 'Say' },
  'ج': { char: 'ج', name: 'Jeem', pronunciation: 'Jeem' },
  'چ': { char: 'چ', name: 'Chay', pronunciation: 'Chay' },
  'ح': { char: 'ح', name: 'Hay', pronunciation: 'Hay' },
  'خ': { char: 'خ', name: 'Khay', pronunciation: 'Khay' },
  'د': { char: 'د', name: 'Daal', pronunciation: 'Daal' },
  'ڈ': { char: 'ڈ', name: 'Ddaal', pronunciation: 'Ddaal' },
  'ذ': { char: 'ذ', name: 'Zaal', pronunciation: 'Zaal' },
  'ر': { char: 'ر', name: 'Ray', pronunciation: 'Ray' },
  'ڑ': { char: 'ڑ', name: 'Rray', pronunciation: 'Rray' },
  'ز': { char: 'ز', name: 'Zay', pronunciation: 'Zay' },
  'ژ': { char: 'ژ', name: 'Zhay', pronunciation: 'Zhay' },
  'س': { char: 'س', name: 'Seen', pronunciation: 'Seen' },
  'ش': { char: 'ش', name: 'Sheen', pronunciation: 'Sheen' },
  'ص': { char: 'ص', name: 'Swaad', pronunciation: 'Swaad' },
  'ض': { char: 'ض', name: 'Zwaad', pronunciation: 'Zwaad' },
  'ط': { char: 'ط', name: 'Toyen', pronunciation: 'Toyen' },
  'ظ': { char: 'ظ', name: 'Zoyen', pronunciation: 'Zoyen' },
  'ع': { char: 'ع', name: 'Ain', pronunciation: 'Ain' },
  'غ': { char: 'غ', name: 'Ghain', pronunciation: 'Ghain' },
  'ف': { char: 'ف', name: 'Fay', pronunciation: 'Fay' },
  'ق': { char: 'ق', name: 'Qaaf', pronunciation: 'Qaaf' },
  'ک': { char: 'ک', name: 'Kaaf', pronunciation: 'Kaaf' },
  'گ': { char: 'گ', name: 'Gaaf', pronunciation: 'Gaaf' },
  'ل': { char: 'ل', name: 'Laam', pronunciation: 'Laam' },
  'م': { char: 'م', name: 'Meem', pronunciation: 'Meem' },
  'ن': { char: 'ن', name: 'Noon', pronunciation: 'Noon' },
  'و': { char: 'و', name: 'Wao', pronunciation: 'Wao' },
  'ہ': { char: 'ہ', name: 'Hay', pronunciation: 'Hay' },
  'ء': { char: 'ء', name: 'Hamza', pronunciation: 'Hamza' },
  'ی': { char: 'ی', name: 'Yay', pronunciation: 'Yay' },
  'ے': { char: 'ے', name: 'Bari Yay', pronunciation: 'Bari Yay' },
};

/**
 * Returns clean bilingual formatted label (e.g. "ا (Alif)")
 */
export function formatSignDisplay(sign: string): string {
  if (URDU_ALPHABET_MAP[sign]) {
    const info = URDU_ALPHABET_MAP[sign];
    return `${info.char} (${info.name})`;
  }
  return sign;
}

/**
 * Returns voice pronunciation string for text-to-speech
 */
export function getSignSpokenText(sign: string): string {
  if (URDU_ALPHABET_MAP[sign]) {
    return URDU_ALPHABET_MAP[sign].pronunciation;
  }
  return sign;
}

/**
 * SignFlow Urdu Alphabet & PSL Extended Phonetic & Romanization Mapping
 * Provides verified Urdu script, English translation, and natural speech synthesis
 * pronunciation for:
 * 1. 37 Pakistan Sign Language Urdu Alphabet characters (Unicode)
 * 2. 89 Pakistan Sign Language Extended categories (Greetings, Phrases, Questions, Vocabulary)
 */

export interface UrduSignInfo {
  char: string;
  name: string;
  pronunciation: string;
}

export const URDU_ALPHABET_MAP: Record<string, UrduSignInfo> = {
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

export const PSL_EXTENDED_MAP: Record<string, UrduSignInfo> = {
  // Greetings & Courtesies
  'Assalamulaikum': { char: 'السلام علیکم', name: 'Assalam-o-Alaikum', pronunciation: 'Assalam o Alaikum' },
  'Walaikumasalam': { char: 'وعلیکم السلام', name: 'Walaikum Assalam', pronunciation: 'Walaikum Assalam' },
  'Barai Mehrbani': { char: 'برائے مہربانی', name: 'Barai Mehrbani (Please)', pronunciation: 'Barai Mehrbani, please' },
  'G Han': { char: 'جی ہاں', name: 'Ji Haan (Yes)', pronunciation: 'Ji Haan, yes' },
  'Nahi hai': { char: 'نہیں ہے', name: 'Nahi Hai (No)', pronunciation: 'Nahi Hai, no' },

  // Questions
  'Kab': { char: 'کب', name: 'Kab (When)', pronunciation: 'Kab, when' },
  'Kesay': { char: 'کیسے', name: 'Kaisay (How)', pronunciation: 'Kaisay, how' },
  'Kya qeemat hai': { char: 'کیا قیمت ہے', name: 'Kya Qeemat Hai (What is the price?)', pronunciation: 'Kya Qeemat Hai, what is the price' },

  // Pronouns & Common Expressions
  'Ap': { char: 'آپ', name: 'Aap (You)', pronunciation: 'Aap' },
  'Apki': { char: 'آپ کی', name: 'Aap Ki (Yours)', pronunciation: 'Aap Ki' },
  'Iski': { char: 'اس کی', name: 'Is Ki (His/Hers/Its)', pronunciation: 'Is Ki' },
  'Mujhay': { char: 'مجھے', name: 'Mujhay (Me)', pronunciation: 'Mujhay' },
  'Ye': { char: 'یہ', name: 'Yeh (This)', pronunciation: 'Yeh' },
  'Bachay': { char: 'بچے', name: 'Bachay (Children)', pronunciation: 'Bachay, children' },
  'Aj': { char: 'آج', name: 'Aaj (Today)', pronunciation: 'Aaj, today' },
  'Baad may': { char: 'بعد میں', name: 'Baad Mein (Later)', pronunciation: 'Baad Mein, later' },
  'Jao': { char: 'جاؤ', name: 'Jao (Go)', pronunciation: 'Jao, go' },
  'Behra': { char: 'بہرہ', name: 'Behra (Deaf)', pronunciation: 'Behra' },
  'Bemar': { char: 'بیمار', name: 'Beemar (Sick)', pronunciation: 'Beemar, sick' },
  'Dur hai': { char: 'دور ہے', name: 'Door Hai (Far away)', pronunciation: 'Door Hai, far away' },
  'Email Address': { char: 'ای میل ایڈریس', name: 'Email Address', pronunciation: 'Email Address' },
  'Hain': { char: 'ہیں', name: 'Hain (Are)', pronunciation: 'Hain' },
  'Mahsoos kar rahay': { char: 'محسوس کر رہے', name: 'Mahsoos Kar Rahay (Feeling)', pronunciation: 'Mahsoos Kar Rahay, feeling' },
  'Samjhna': { char: 'سمجھنا', name: 'Samajhna (Understand)', pronunciation: 'Samajhna, understand' },
  'Seekh raha hun': { char: 'سیکھ رہا ہوں', name: 'Seekh Raha Hoon (I am learning)', pronunciation: 'Seekh Raha Hoon, I am learning' },
  'Shirt dhona hai': { char: 'شرٹ دھونا ہے', name: 'Shirt Dhona Hai (Need to wash shirt)', pronunciation: 'Shirt Dhona Hai, need to wash shirt' },
  'Yaqeen': { char: 'یقین', name: 'Yaqeen (Trust)', pronunciation: 'Yaqeen, trust' },

  // Urdu Alphabets in Extended Dataset
  'Alif': { char: 'ا', name: 'Alif', pronunciation: 'Alif' },
  'Bay': { char: 'ب', name: 'Bay', pronunciation: 'Bay' },
  'Pay': { char: 'پ', name: 'Pay', pronunciation: 'Pay' },
  'Tay': { char: 'ت', name: 'Tay', pronunciation: 'Tay' },
  'Ttay': { char: 'ٹ', name: 'Ttay', pronunciation: 'Ttay' },
  'Say': { char: 'ث', name: 'Say', pronunciation: 'Say' },
  'Jeem': { char: 'ج', name: 'Jeem', pronunciation: 'Jeem' },
  'Chay': { char: 'چ', name: 'Chay', pronunciation: 'Chay' },
  'Hay': { char: 'ح', name: 'Hay', pronunciation: 'Hay' },
  'Khay': { char: 'خ', name: 'Khay', pronunciation: 'Khay' },
  'Dal': { char: 'د', name: 'Daal', pronunciation: 'Daal' },
  'Ddal': { char: 'ڈ', name: 'Ddaal', pronunciation: 'Ddaal' },
  'Zal': { char: 'ذ', name: 'Zaal', pronunciation: 'Zaal' },
  'Ray': { char: 'ر', name: 'Ray', pronunciation: 'Ray' },
  'rray': { char: 'ڑ', name: 'Rray', pronunciation: 'Rray' },
  'zay': { char: 'ز', name: 'Zay', pronunciation: 'Zay' },
  'seen': { char: 'س', name: 'Seen', pronunciation: 'Seen' },
  'Sheen': { char: 'ش', name: 'Sheen', pronunciation: 'Sheen' },
  'suaad': { char: 'ص', name: 'Swaad', pronunciation: 'Swaad' },
  'Zuaad': { char: 'ض', name: 'Zwaad', pronunciation: 'Zwaad' },
  'Toain': { char: 'ط', name: 'Toyen', pronunciation: 'Toyen' },
  'Zoain': { char: 'ظ', name: 'Zoyen', pronunciation: 'Zoyen' },
  'Ain': { char: 'ع', name: 'Ain', pronunciation: 'Ain' },
  'Ghain': { char: 'غ', name: 'Ghain', pronunciation: 'Ghain' },
  'Fay': { char: 'ف', name: 'Fay', pronunciation: 'Fay' },
  'Qaaf': { char: 'ق', name: 'Qaaf', pronunciation: 'Qaaf' },
  'Kaaf': { char: 'ک', name: 'Kaaf', pronunciation: 'Kaaf' },
  'Gaaf': { char: 'گ', name: 'Gaaf', pronunciation: 'Gaaf' },
  'Laam': { char: 'ل', name: 'Laam', pronunciation: 'Laam' },
  'Meem': { char: 'م', name: 'Meem', pronunciation: 'Meem' },
  'Noon': { char: 'ن', name: 'Noon', pronunciation: 'Noon' },
  'Wao': { char: 'و', name: 'Wao', pronunciation: 'Wao' },
  'He': { char: 'ہ', name: 'Gol Hay', pronunciation: 'Gol Hay' },
  'Hamza': { char: 'ء', name: 'Hamza', pronunciation: 'Hamza' },
  'Choti-ye': { char: 'ی', name: 'Choti Yay', pronunciation: 'Choti Yay' },
  'bari-ye': { char: 'ے', name: 'Bari Yay', pronunciation: 'Bari Yay' },

  // Fruits & Animals
  'APPLE': { char: 'سیب', name: 'Apple', pronunciation: 'Apple' },
  'Cherry': { char: 'چیری', name: 'Cherry', pronunciation: 'Cherry' },
  'Duck': { char: 'بطخ', name: 'Duck', pronunciation: 'Duck' },
  'Eagle': { char: 'عقاب', name: 'Eagle', pronunciation: 'Eagle' },
  'Falcon': { char: 'شاہین', name: 'Falcon', pronunciation: 'Falcon' },
  'Fig': { char: 'انجیر', name: 'Fig', pronunciation: 'Fig' },
  'Guava': { char: 'امرود', name: 'Guava', pronunciation: 'Guava' },
  'Peach': { char: 'آڑو', name: 'Peach', pronunciation: 'Peach' },
  'Penguin': { char: 'پینگوئن', name: 'Penguin', pronunciation: 'Penguin' },
  'Pigeon': { char: 'کبوتر', name: 'Pigeon', pronunciation: 'Pigeon' },
  'Pineapple': { char: 'انناس', name: 'Pineapple', pronunciation: 'Pineapple' },
  'Watermelon': { char: 'تربوز', name: 'Watermelon', pronunciation: 'Watermelon' },
  'Woodpecker': { char: 'ہدہد', name: 'Woodpecker', pronunciation: 'Woodpecker' },
  'Cuckoo': { char: 'کوئل', name: 'Cuckoo', pronunciation: 'Cuckoo' },
  'owl': { char: 'الو', name: 'Owl', pronunciation: 'Owl' },
  'parrot': { char: 'طوطا', name: 'Parrot', pronunciation: 'Parrot' },

  // Historical & Cultural
  'Allah': { char: 'اللہ', name: 'Allah', pronunciation: 'Allah' },
  'Allama Iqbal': { char: 'علامہ اقبال', name: 'Allama Iqbal', pronunciation: 'Allama Iqbal' },
  'Muhammad Ali Jinnah': { char: 'محمد علی جناح', name: 'Quaid-e-Azam Muhammad Ali Jinnah', pronunciation: 'Muhammad Ali Jinnah' },
  'Muhammad Bin Qasim': { char: 'محمد بن قاسم', name: 'Muhammad Bin Qasim', pronunciation: 'Muhammad Bin Qasim' },
  'Zulfiqar Ali Bhutto': { char: 'ذوالفقار علی بھٹو', name: 'Zulfiqar Ali Bhutto', pronunciation: 'Zulfiqar Ali Bhutto' },
  'Mahatma Gandhi': { char: 'مہاتما گاندھی', name: 'Mahatma Gandhi', pronunciation: 'Mahatma Gandhi' },
  'Lord Mountbatten': { char: 'لارڈ ماؤنٹ بیٹن', name: 'Lord Mountbatten', pronunciation: 'Lord Mountbatten' },
  'Sikander-e-Azam': { char: 'سکندر اعظم', name: 'Alexander the Great', pronunciation: 'Sikander-e-Azam' },
  'Firaun': { char: 'فرعون', name: 'Pharaoh', pronunciation: 'Pharaoh' },
  'Genghis Khan': { char: 'چنگیز خان', name: 'Genghis Khan', pronunciation: 'Genghis Khan' },
};

export const DEICTIC_AND_COMMON_WORDS_MAP: Record<string, UrduSignInfo> = {
  ME: { char: 'میں', name: 'Me', pronunciation: 'Me' },
  YOU: { char: 'آپ', name: 'You', pronunciation: 'You' },
  THIS: { char: 'یہ', name: 'This', pronunciation: 'This' },
  MY: { char: 'میرا', name: 'My', pronunciation: 'My' },
  YOUR: { char: 'آپ کا', name: 'Your', pronunciation: 'Your' },
  NAME: { char: 'نام', name: 'Name', pronunciation: 'Name' },
  GOOD: { char: 'اچھا', name: 'Good', pronunciation: 'Good' },
  KNOW: { char: 'جاننا', name: 'Know', pronunciation: 'Know' },
  PHONE: { char: 'فون', name: 'Phone', pronunciation: 'Phone' },
  THANKS: { char: 'شکریہ', name: 'Thanks', pronunciation: 'Thank you' },
  WHAT: { char: 'کیا', name: 'What', pronunciation: 'What' },
  HELLO: { char: 'ہیلو', name: 'Hello', pronunciation: 'Hello' },
  STOP: { char: 'رکیں', name: 'Stop', pronunciation: 'Stop' },
  HELP: { char: 'مدد', name: 'Help', pronunciation: 'Help' },
  YES: { char: 'جی ہاں', name: 'Yes', pronunciation: 'Yes' },
  NO: { char: 'نہیں', name: 'No', pronunciation: 'No' },
  PLEASE: { char: 'برائے مہربانی', name: 'Please', pronunciation: 'Please' },
  'THANK YOU': { char: 'شکریہ', name: 'Thank You', pronunciation: 'Thank you' },
  SORRY: { char: 'معاف کیجئے', name: 'Sorry', pronunciation: 'Sorry' },
  MORE: { char: 'مزید', name: 'More', pronunciation: 'More' },
  'ALL DONE': { char: 'مکمل', name: 'All Done', pronunciation: 'All done' },
  FIND: { char: 'تلاش', name: 'Find', pronunciation: 'Find' },
  WANT: { char: 'چاہنا', name: 'Want', pronunciation: 'Want' },
  OPEN: { char: 'کھولیں', name: 'Open', pronunciation: 'Open' },
  SIT: { char: 'بیٹھیں', name: 'Sit', pronunciation: 'Sit' },
  SLEEP: { char: 'سونا', name: 'Sleep', pronunciation: 'Sleep' },
  PLAY: { char: 'کھیلنا', name: 'Play', pronunciation: 'Play' },
  EAT: { char: 'کھانا', name: 'Eat', pronunciation: 'Eat' },
  DRINK: { char: 'پینا', name: 'Drink', pronunciation: 'Drink' },
  HURT: { char: 'تکلیف', name: 'Hurt', pronunciation: 'Hurt' },
  RESTROOM: { char: 'باتھ روم', name: 'Restroom', pronunciation: 'Restroom' },
  GO: { char: 'جائیں', name: 'Go', pronunciation: 'Go' },
  NICE: { char: 'اچھا', name: 'Nice', pronunciation: 'Nice' },
  MEET: { char: 'ملنا', name: 'Meet', pronunciation: 'Meet' },
  WATER: { char: 'پانی', name: 'Water', pronunciation: 'Water' },
  MEDICINE: { char: 'دوا', name: 'Medicine', pronunciation: 'Medicine' },
  Dawa: { char: 'دوا', name: 'Medicine', pronunciation: 'Dawa' },
  BUY: { char: 'خریدنا', name: 'Buy', pronunciation: 'Buy' },
  Kharidna: { char: 'خریدنا', name: 'Buy', pronunciation: 'Kharidna' },
  ILL: { char: 'بیمار', name: 'Ill', pronunciation: 'Ill' },
  SICK: { char: 'بیمار', name: 'Sick', pronunciation: 'Sick' },
  HOSPITAL: { char: 'ہسپتال', name: 'Hospital', pronunciation: 'Hospital' },
  PHARMACY: { char: 'فارمیسی', name: 'Pharmacy', pronunciation: 'Pharmacy' },
};

/**
 * Returns clean bilingual formatted label (e.g. "السلام علیکم (Assalam-o-Alaikum)" or "ا (Alif)")
 */
export function formatSignDisplay(sign: string | null): string {
  if (!sign) return '';
  if (PSL_EXTENDED_MAP[sign]) {
    const info = PSL_EXTENDED_MAP[sign];
    return `${info.char} (${info.name})`;
  }
  if (URDU_ALPHABET_MAP[sign]) {
    const info = URDU_ALPHABET_MAP[sign];
    return `${info.char} (${info.name})`;
  }
  if (DEICTIC_AND_COMMON_WORDS_MAP[sign]) {
    const info = DEICTIC_AND_COMMON_WORDS_MAP[sign];
    return `${info.char} (${info.name})`;
  }
  return sign;
}

/**
 * Returns voice pronunciation string for text-to-speech
 */
export function getSignSpokenText(sign: string | null): string {
  if (!sign) return '';
  if (PSL_EXTENDED_MAP[sign]) {
    return PSL_EXTENDED_MAP[sign].pronunciation;
  }
  if (URDU_ALPHABET_MAP[sign]) {
    return URDU_ALPHABET_MAP[sign].pronunciation;
  }
  if (DEICTIC_AND_COMMON_WORDS_MAP[sign]) {
    return DEICTIC_AND_COMMON_WORDS_MAP[sign].pronunciation;
  }
  return sign;
}

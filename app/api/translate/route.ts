import { NextRequest, NextResponse } from 'next/server';

export interface TranslateRequest {
  tokens: string[];
  language?: string;
  previousContext?: string;
  sessionId?: string;
}

export interface TranslateResponse {
  translatedText: string;
  tokens: string[];
  isAiSynthesized: boolean;
  model: string;
  latencyMs: number;
  notice?: string;
}

/**
 * Deterministic fallback linguistic synthesizer for target ASL signs.
 * Provides instant, zero-latency grammatical sentences if cloud LLM is offline or unconfigured.
 */
function synthesizeGrammarLocally(tokens: string[]): string {
  const upper = tokens.map((t) => t.trim().toUpperCase());
  const tokenSet = new Set(upper);

  // Multi-token composite patterns
  if (tokenSet.has('THANK YOU') && tokenSet.has('GO') && tokenSet.has('RESTROOM')) {
    return 'Thank you, I am going to the restroom now.';
  }
  if (tokenSet.has('THANK YOU') && tokenSet.has('GO')) {
    return 'Thank you, I am going now.';
  }
  if (tokenSet.has('HELP') && tokenSet.has('PLEASE')) {
    return 'Can you please help me?';
  }
  if (tokenSet.has('MORE') && (tokenSet.has('EAT') || tokenSet.has('FOOD'))) {
    return 'I would like more food, please.';
  }
  if (tokenSet.has('DRINK') && tokenSet.has('PLEASE')) {
    return 'Can I have some water to drink, please?';
  }
  if (tokenSet.has('STOP') && tokenSet.has('PLAY')) {
    return 'Please stop playing.';
  }
  if (tokenSet.has('YES') && tokenSet.has('PLEASE')) {
    return 'Yes, please.';
  }
  if (tokenSet.has('NO') && tokenSet.has('THANK YOU')) {
    return 'No, thank you.';
  }
  if (tokenSet.has('GO') && tokenSet.has('RESTROOM')) {
    return 'I need to go to the restroom.';
  }
  if (tokenSet.has('PLAY') && tokenSet.has('PLEASE')) {
    return 'Can we play, please?';
  }
  if (tokenSet.has('HURT') && tokenSet.has('HELP')) {
    return 'It hurts, please help me.';
  }
  if (tokenSet.has('SORRY') && tokenSet.has('PLEASE')) {
    return 'I am really sorry, please forgive me.';
  }
  if (tokenSet.has('WANT') && tokenSet.has('DRINK')) {
    return 'I want something to drink.';
  }
  if (tokenSet.has('WANT') && tokenSet.has('EAT')) {
    return 'I want something to eat.';
  }
  if (tokenSet.has('FIND') && tokenSet.has('HELP')) {
    return 'Please help me find it.';
  }
  if (tokenSet.has('ALL DONE') && tokenSet.has('THANK YOU')) {
    return 'All done, thank you very much.';
  }
  if (tokenSet.has('OPEN') && tokenSet.has('PLEASE')) {
    return 'Please open this.';
  }
  if (tokenSet.has('SIT') && tokenSet.has('PLEASE')) {
    return 'Please have a seat.';
  }

  // Single-token dictionary for all 20 ASL chart signs + HELLO
  const singleTokenMap: Record<string, string> = {
    'YES': 'Yes, I agree.',
    'NO': 'No, I disagree.',
    'PLEASE': 'Please.',
    'THANK YOU': 'Thank you very much.',
    'SORRY': 'I am really sorry.',
    'HELP': 'I need help, please.',
    'MORE': 'I want more.',
    'ALL DONE': 'All finished, all done.',
    'FIND': 'Can you help me find it?',
    'WANT': 'I want this.',
    'OPEN': 'Please open this.',
    'SIT': 'Please sit down.',
    'SLEEP': 'I am tired, I need to sleep.',
    'PLAY': 'I want to play.',
    'EAT': 'I am hungry, I want to eat.',
    'DRINK': 'I am thirsty, I want a drink.',
    'HURT': 'It hurts, I am in pain.',
    'RESTROOM': 'Where is the restroom?',
    'STOP': 'Please stop.',
    'GO': 'Let us go.',
    'HELLO': 'Hello, nice to see you.',
  };

  if (tokens.length === 1 && singleTokenMap[upper[0]]) {
    return singleTokenMap[upper[0]];
  }

  // Concatenative formatting
  const formattedWords = upper.map((t) => {
    const lower = t.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
  return formattedWords.join(' ') + '.';
}

/**
 * POST /api/translate
 *
 * Ingests recognized gesture tokens from Step 3 pattern classification
 * and queries Google Gemini Flash to synthesize fluid, localized conversational grammar.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body: TranslateRequest = await req.json();

    // 1. Input Validation
    if (!body || !Array.isArray(body.tokens) || body.tokens.length === 0) {
      return NextResponse.json<TranslateResponse>(
        {
          translatedText: '',
          tokens: [],
          isAiSynthesized: false,
          model: 'none',
          latencyMs: 0,
          notice: 'No sign tokens provided in payload.',
        },
        { status: 200 }
      );
    }

    const cleanTokens = body.tokens
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean);

    if (cleanTokens.length === 0) {
      return NextResponse.json<TranslateResponse>(
        {
          translatedText: '',
          tokens: [],
          isAiSynthesized: false,
          model: 'none',
          latencyMs: 0,
          notice: 'Tokens array contained only whitespace.',
        },
        { status: 200 }
      );
    }

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();

    // 2. If Gemini API Key is missing, use deterministic grammar engine immediately
    if (!apiKey) {
      const fallbackText = synthesizeGrammarLocally(cleanTokens);
      const latencyMs = Date.now() - startTime;
      return NextResponse.json<TranslateResponse>(
        {
          translatedText: fallbackText,
          tokens: cleanTokens,
          isAiSynthesized: false,
          model: 'local-grammar-rule',
          latencyMs,
          notice: 'GEMINI_API_KEY unconfigured; processed via deterministic grammar engine.',
        },
        { status: 200 }
      );
    }

    // 3. Format targeted assistive translation prompt
    const prompt = `You are SignFlow's expert assistive sign language interpreter.
Your task is to synthesize the following sequence of recognized structural hand sign tokens into a single natural, fluent, dignified English sentence for deaf and hard-of-hearing communication.

Recognized sign tokens: ${cleanTokens.join(', ')}
${body.previousContext ? `Previous conversational context: "${body.previousContext}"` : ''}

CRITICAL RULES:
1. Output ONLY the synthesized natural English sentence.
2. Do NOT wrap in quotes, do not output explanations, token lists, or meta-commentary.
3. Faithfully convey the person's communicative intent (e.g. ["THANK YOU", "GO", "RESTROOM"] -> "Thank you, I am going to the restroom now.").
4. Keep the wording clear, polite, and conversational.`;

    // 4. Upstream Gemini API call with resilient model fallback pool
    const modelsToTry = [
      process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-flash-latest',
    ];

    let synthesizedText = '';
    let usedModel = 'gemini-2.5-flash';

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Enforce 3.5s timeout to maintain high responsiveness in live signing session
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 120,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const candidateText =
            data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

          if (candidateText) {
            // Strip any surrounding quote marks
            synthesizedText = candidateText.replace(/^["'`]|["'`]$/g, '').trim();
            usedModel = model;
            break;
          }
        }
      } catch (err) {
        console.warn(`[POST /api/translate] Model ${model} request error:`, err);
        // Continue to next model in pool
      }
    }

    // 5. If cloud generation succeeded, return AI synthesized response
    if (synthesizedText) {
      const latencyMs = Date.now() - startTime;
      return NextResponse.json<TranslateResponse>(
        {
          translatedText: synthesizedText,
          tokens: cleanTokens,
          isAiSynthesized: true,
          model: usedModel,
          latencyMs,
        },
        { status: 200 }
      );
    }

    // 6. Resilient Fallback: If cloud models failed or timed out, use local grammar engine
    const fallbackText = synthesizeGrammarLocally(cleanTokens);
    const latencyMs = Date.now() - startTime;
    return NextResponse.json<TranslateResponse>(
      {
        translatedText: fallbackText,
        tokens: cleanTokens,
        isAiSynthesized: false,
        model: 'local-grammar-rule',
        latencyMs,
        notice: 'Cloud AI temporarily busy; synthesized via local linguistic engine.',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Unhandled error in POST /api/translate:', error);
    const latencyMs = Date.now() - startTime;
    return NextResponse.json<TranslateResponse>(
      {
        translatedText: '',
        tokens: [],
        isAiSynthesized: false,
        model: 'error',
        latencyMs,
        notice: 'Internal translation error occurred.',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { SuggestRepliesRequest, SuggestRepliesResponse } from '@/types/app';
import { getSuggestedRepliesForText } from '@/lib/replyCatalogue';

/**
 * POST /api/suggest-replies
 *
 * Provides context-aware suggested PSL sign replies strictly for 'partner' mode.
 * Rejects requests from 'signing' mode with 403 Forbidden.
 */
export async function POST(req: NextRequest) {
  try {
    const body: SuggestRepliesRequest = await req.json();

    // 1. Strict Server-Side Mode Enforcement
    if (body.mode !== 'partner') {
      return NextResponse.json(
        {
          error:
            'Suggested replies are exclusively available when "Someone with me is signing" (partner mode).',
          messageId: body?.messageId || '',
          suggestions: [],
          isFallback: false,
        },
        { status: 403 }
      );
    }

    // 2. Input Validation
    if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
      return NextResponse.json(
        {
          messageId: body.messageId || '',
          suggestions: [],
          isFallback: false,
          notice: 'No valid translated text provided.',
        },
        { status: 200 }
      );
    }

    // 3. Contextual Reply Ranking & Catalogue Mapping
    // Constrained to verified PSL reference catalogue to prevent invented hand shapes.
    const suggestions = getSuggestedRepliesForText(body.text);

    const responsePayload: SuggestRepliesResponse = {
      messageId: body.messageId,
      suggestions,
      isFallback: false,
      notice:
        'Suggestions mapped to verified Pakistan Sign Language reference catalogue.',
    };

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: any) {
    console.error('Error generating suggested replies:', error);
    return NextResponse.json(
      {
        messageId: '',
        suggestions: [],
        isFallback: true,
        notice: 'Suggested reply service temporarily unavailable.',
      },
      { status: 500 }
    );
  }
}

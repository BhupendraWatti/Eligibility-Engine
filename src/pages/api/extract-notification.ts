import type { APIRoute } from 'astro';
import { extractNotification, extractedToCriteria } from '../../engine/extract-notification';

/**
 * POST /api/extract-notification
 *
 * Admin-only endpoint. Accepts raw notification text and returns
 * extracted eligibility fields with confidence scores. Used by the
 * admin panel to pre-fill recruitment eligibility from pasted notification text.
 *
 * Request body: { text: string }
 * Response: { extracted: ExtractedNotification, criteria: object, warnings: string[] }
 */
export const POST: APIRoute = async ({ request, locals }) => {
  // Admin-only access (middleware sets locals.adminEmail for authenticated admins)
  // @ts-ignore
  if (!locals.adminEmail) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();

    if (!body.text || typeof body.text !== 'string') {
      return new Response(JSON.stringify({ error: 'Request body must contain "text" field with notification content' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.text.length > 100_000) {
      return new Response(JSON.stringify({ error: 'Notification text exceeds 100KB limit' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const extracted = extractNotification(body.text);
    const { criteria, warnings } = extractedToCriteria(extracted);

    return new Response(JSON.stringify({
      extracted,
      criteria,
      warnings,
      meta: {
        extractionScore: extracted.extractionScore,
        unextractedFields: extracted.unextractedFields,
        inputLength: body.text.length,
      },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extraction failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

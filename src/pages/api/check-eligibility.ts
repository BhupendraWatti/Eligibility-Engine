import type { APIRoute } from 'astro';
import { getAllActiveRecruitments } from '../../db/queries';
import { getEligibleJobs, type RecruitmentRecord } from '../../engine/batch-eligibility';
import type { UserEligibilityProfile } from '../../engine/eligibility';

/**
 * POST /api/check-eligibility
 *
 * Accepts a user profile and evaluates eligibility against all active
 * recruitments from the database. Returns three-bucket categorization
 * with structured progressive questions for missing fields.
 *
 * Request body: UserEligibilityProfile (JSON)
 * Response: BatchEligibilityResult (JSON)
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const userProfile = validateProfile(body);

    // Fetch all active recruitments from D1 (or fallback)
    const allRecruitments = await getAllActiveRecruitments();

    // Map to the batch engine's record format
    const records: RecruitmentRecord[] = allRecruitments.map(r => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      advtNumber: r.advtNumber,
      totalVacancies: r.totalVacancies,
      postTitle: r.postTitle,
      organisationName: r.organisationName,
      organisationShortName: r.organisationShortName,
      isFeatured: r.isFeatured,
      lifecycleStatus: r.lifecycleStatus,
      criteria: r.criteria,
    }));

    const result = getEligibleJobs(userProfile, records);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/** Validate and sanitize the incoming user profile */
function validateProfile(body: any): UserEligibilityProfile {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object');
  }

  const profile: UserEligibilityProfile = {};

  // DOB validation
  if (body.dob) {
    if (typeof body.dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.dob)) {
      throw new Error('dob must be in YYYY-MM-DD format');
    }
    profile.dob = body.dob;
  }

  // Gender validation
  if (body.gender) {
    if (!['MALE', 'FEMALE', 'OTHER'].includes(body.gender)) {
      throw new Error('gender must be MALE, FEMALE, or OTHER');
    }
    profile.gender = body.gender;
  }

  // Category validation
  if (body.category) {
    if (!['UR', 'SC', 'ST', 'OBC', 'EWS'].includes(body.category)) {
      throw new Error('category must be UR, SC, ST, OBC, or EWS');
    }
    profile.category = body.category;
  }

  // Boolean fields
  if (body.isMpDomicile !== undefined) profile.isMpDomicile = Boolean(body.isMpDomicile);
  if (body.hasMpRojgarPanjiyan !== undefined) profile.hasMpRojgarPanjiyan = Boolean(body.hasMpRojgarPanjiyan);
  if (body.hasCpct !== undefined) profile.hasCpct = Boolean(body.hasCpct);

  // Qualification validation
  if (body.qualificationLevel) {
    if (!['8TH', '10TH', '12TH', 'DIPLOMA', 'GRADUATION', 'POST_GRADUATION'].includes(body.qualificationLevel)) {
      throw new Error('qualificationLevel must be 8TH, 10TH, 12TH, DIPLOMA, GRADUATION, or POST_GRADUATION');
    }
    profile.qualificationLevel = body.qualificationLevel;
  }

  // Numeric fields
  if (body.percentage !== undefined) {
    const pct = Number(body.percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) throw new Error('percentage must be 0-100');
    profile.percentage = pct;
  }
  if (body.heightCm !== undefined) {
    const h = Number(body.heightCm);
    if (isNaN(h) || h < 50 || h > 250) throw new Error('heightCm must be 50-250');
    profile.heightCm = h;
  }
  if (body.chestCm !== undefined) {
    const c = Number(body.chestCm);
    if (isNaN(c) || c < 40 || c > 200) throw new Error('chestCm must be 40-200');
    profile.chestCm = c;
  }

  // Additional skills
  if (body.additionalSkills) {
    if (!Array.isArray(body.additionalSkills)) throw new Error('additionalSkills must be an array of strings');
    profile.additionalSkills = body.additionalSkills.filter((s: any) => typeof s === 'string');
  }

  return profile;
}

-- 0017: one "who can apply" value per recruitment (docs/designs/domicile-scope.md).
-- domicile_scope: UNKNOWN (not checked) | STATE_ONLY | OPEN | OPEN_STATE_QUOTA, always about the recruitment's own state.
-- The legacy columns are re-derived from it here and by the writers (src/services/domicile-scope.ts).
ALTER TABLE recruitment_eligibility ADD COLUMN domicile_scope TEXT NOT NULL DEFAULT 'UNKNOWN';

-- Central is never domicile-locked.
UPDATE recruitment_eligibility SET domicile_scope = 'OPEN'
  WHERE recruitment_id IN (SELECT r.id FROM recruitments r JOIN states s ON s.id = r.state_id WHERE s.code = 'IN');

-- An explicit lock survives only when it names the recruitment's own state (a bare MP flag means MP).
UPDATE recruitment_eligibility SET domicile_scope = 'STATE_ONLY'
  WHERE domicile_scope = 'UNKNOWN'
    AND recruitment_id IN (
      SELECT r.id FROM recruitments r JOIN states s ON s.id = r.state_id
      WHERE s.code <> 'IN'
        AND UPPER(COALESCE(recruitment_eligibility.domicile_state_code,
                           CASE WHEN recruitment_eligibility.requires_mp_domicile = 1 THEN 'MP' END)) = s.code);

-- Everything else stays UNKNOWN: an empty domicile code was never evidence that outsiders may apply.

-- Backfill the legacy columns from scope (same rules as deriveDomicileColumns).
UPDATE recruitment_eligibility SET domicile_state_code = NULL, requires_mp_domicile = 0
  WHERE domicile_scope <> 'STATE_ONLY';
UPDATE recruitment_eligibility
  SET domicile_state_code = (SELECT s.code FROM recruitments r JOIN states s ON s.id = r.state_id WHERE r.id = recruitment_eligibility.recruitment_id),
      reservation_state_code = (SELECT s.code FROM recruitments r JOIN states s ON s.id = r.state_id WHERE r.id = recruitment_eligibility.recruitment_id)
  WHERE domicile_scope = 'STATE_ONLY';
UPDATE recruitment_eligibility SET requires_mp_domicile = CASE WHEN domicile_state_code = 'MP' THEN 1 ELSE 0 END
  WHERE domicile_scope = 'STATE_ONLY';
UPDATE recruitment_eligibility SET reservation_state_code = NULL
  WHERE domicile_scope = 'OPEN';
UPDATE recruitment_eligibility
  SET reservation_state_code = (SELECT s.code FROM recruitments r JOIN states s ON s.id = r.state_id WHERE r.id = recruitment_eligibility.recruitment_id)
  WHERE domicile_scope = 'UNKNOWN';

-- 0019: Results Board. A result is an official link on its recruitment, so it rides the existing proposal ->
-- admin approval flow (nothing is public until an admin approves). These columns say WHAT kind of result the
-- link is and WHEN it was declared, and let a newer result retire an older one (provisional -> final).
ALTER TABLE official_links ADD COLUMN result_type TEXT;       -- FINAL | PROVISIONAL | MERIT_LIST | CUT_OFF | SCORECARD (only on result links)
ALTER TABLE official_links ADD COLUMN declared_on TEXT;       -- ISO date the result was declared
ALTER TABLE official_links ADD COLUMN superseded INTEGER NOT NULL DEFAULT 0; -- 1 = replaced by a newer result of the same recruitment
CREATE INDEX IF NOT EXISTS idx_links_result ON official_links(result_type, declared_on);

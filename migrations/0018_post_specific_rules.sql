-- 0018: one recruitment can cover posts with different rules (e.g. a sports advert with coaches and lifeguards).
-- The stored criteria are then the least strict rule any post accepts, and this note says how the posts differ.
-- When it is set, the eligibility engine never says "eligible" outright: it asks the candidate to check the note.
ALTER TABLE recruitment_eligibility ADD COLUMN post_specific_rules TEXT;

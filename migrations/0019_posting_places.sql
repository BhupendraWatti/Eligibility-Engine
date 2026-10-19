-- 0019: the places a recruitment's notice says candidates are posted to (src/services/posting-places.ts).
-- JSON list of {locality, stateCode, postalCode?, streetAddress?}; NULL when the notice names none (statewide or all-India).
-- Shown on the public page and given to Google as JobPosting.jobLocation.
ALTER TABLE recruitments ADD COLUMN posting_places_json TEXT;

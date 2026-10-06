-- 0016: state-scoped reservation benefits and category-wise minimum qualification.
-- reservation_state_code: category/women age relaxations apply only to this state's domiciles (others compete as UR).
-- qualification_by_category_json: e.g. {"ST":"8TH"} overriding min_qualification_level for that category.
ALTER TABLE recruitment_eligibility ADD COLUMN reservation_state_code TEXT;
ALTER TABLE recruitment_eligibility ADD COLUMN qualification_by_category_json TEXT;

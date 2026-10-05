-- MPESB Police HQ 2026 (Subedar / ASI Stenographic cadres) had no canonical posts.
-- Idempotent: ids and slugs are unique, and the NOT EXISTS guard also skips a post that was
-- already added under the same title, so re-running this never creates a duplicate.
INSERT OR IGNORE INTO posts (
  id, department_id, sector_id, title, slug, summary, pay_scale,
  default_min_age, default_max_age, default_qualification, is_active
)
SELECT 'post_mp_subedar_steno', 'dept_home', 'sec_police',
  'Subedar (Stenographic) - Stenographer', 'mp-police-subedar-stenographer',
  'Stenographer cadre of MP Police at Subedar rank handling shorthand dictation, typing and confidential correspondence for police offices.',
  'Rs. 36,200 - 1,14,800/-', 18, 33, '12TH', 1
WHERE NOT EXISTS (SELECT 1 FROM posts WHERE id = 'post_mp_subedar_steno' OR slug = 'mp-police-subedar-stenographer');

INSERT OR IGNORE INTO posts (
  id, department_id, sector_id, title, slug, summary, pay_scale,
  default_min_age, default_max_age, default_qualification, is_active
)
SELECT 'post_mp_asi_steno', 'dept_home', 'sec_police',
  'Assistant Sub Inspector (Stenographic)', 'mp-police-asi-stenographic',
  'Stenographic cadre Assistant Sub Inspector in MP Police handling office records, typing and computer work in police units and branches.',
  'Rs. 19,500 - 62,000/-', 18, 33, '12TH', 1
WHERE NOT EXISTS (SELECT 1 FROM posts WHERE id = 'post_mp_asi_steno' OR slug = 'mp-police-asi-stenographic');

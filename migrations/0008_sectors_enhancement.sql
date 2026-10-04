-- Migration 0008: Sectors enhancement (description, theme, is_active, timestamps)
ALTER TABLE sectors ADD COLUMN description TEXT;
ALTER TABLE sectors ADD COLUMN theme TEXT DEFAULT 'blue' NOT NULL;
ALTER TABLE sectors ADD COLUMN is_active INTEGER DEFAULT 1 NOT NULL;
-- SQLite rejects non-constant defaults when adding columns to an existing table.
ALTER TABLE sectors ADD COLUMN created_at INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE sectors ADD COLUMN updated_at INTEGER DEFAULT 0 NOT NULL;

UPDATE sectors SET created_at = unixepoch(), updated_at = unixepoch();

-- Backfill existing sectors with professional descriptions, themes, and lowercase semantic icon keys
UPDATE sectors SET
  description = 'State administrative service, executive magistracy, and public governance cadres.',
  icon = 'landmark',
  theme = 'blue'
WHERE id = 'sec_civil_services';

UPDATE sectors SET
  description = 'Law enforcement, armed constabulary, state investigation agencies, and prison wardens.',
  icon = 'shield',
  theme = 'indigo'
WHERE id = 'sec_police';

UPDATE sectors SET
  description = 'Subordinate courts, judicial services, prosecution officers, and legal registry.',
  icon = 'scale',
  theme = 'slate'
WHERE id = 'sec_judiciary';

UPDATE sectors SET
  description = 'Digital governance, state IT infrastructure, cybersecurity, and systems engineering.',
  icon = 'monitor',
  theme = 'cyan'
WHERE id = 'sec_it_egov';

UPDATE sectors SET
  description = 'Land records, survey settlement, revenue collection, and Patwari administration.',
  icon = 'building',
  theme = 'amber'
WHERE id = 'sec_admin';

UPDATE sectors SET
  description = 'Forestry preservation, wildlife sanctuary surveillance, and environmental protection.',
  icon = 'trees',
  theme = 'green'
WHERE id = 'sec_forest';

UPDATE sectors SET
  description = 'Primary, secondary, collegiate faculty, and university academic administration.',
  icon = 'graduation-cap',
  theme = 'purple'
WHERE id = 'sec_teaching';

UPDATE sectors SET
  description = 'Public works, irrigation engineering, polytechnic cadres, and skilled mechanical trades.',
  icon = 'wrench',
  theme = 'amber'
WHERE id = 'sec_technical';

UPDATE sectors SET
  description = 'Hospital healthcare, clinical nursing, community medicine, and public health cadres.',
  icon = 'activity',
  theme = 'red'
WHERE id = 'sec_health';

UPDATE sectors SET
  description = 'Ministerial staff, multi-tasking staff, drivers, and institutional support cadres.',
  icon = 'briefcase',
  theme = 'slate'
WHERE id = 'sec_support';

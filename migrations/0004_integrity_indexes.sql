-- Integrity and relation lookup indexes required before production import.
CREATE UNIQUE INDEX IF NOT EXISTS unq_rec_org_advt_cycle
  ON recruitments (organisation_id, advt_number, cycle_year);
CREATE INDEX IF NOT EXISTS idx_sources_rec ON sources (recruitment_id);
CREATE INDEX IF NOT EXISTS idx_links_rec ON official_links (recruitment_id);

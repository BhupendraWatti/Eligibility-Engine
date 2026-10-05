-- MCP proposal lifecycle: link a replacement to the proposal it supersedes, and carry reviewer-facing
-- metadata (field evidence, possible-duplicate warning) beside the allowlisted payload.
-- 'WITHDRAWN' needs no DDL: change_proposals.status is plain TEXT.
ALTER TABLE change_proposals ADD COLUMN supersedes_id TEXT;
ALTER TABLE change_proposals ADD COLUMN meta TEXT;
CREATE INDEX IF NOT EXISTS idx_proposals_supersedes ON change_proposals(supersedes_id);

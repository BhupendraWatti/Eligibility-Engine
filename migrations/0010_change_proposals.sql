-- 15. Change Proposals (MCP -> human approval queue)
-- The private MCP may only INSERT rows here. Live recruitment tables are changed solely by an
-- authenticated admin approving a proposal in /admin/pending-changes.
CREATE TABLE IF NOT EXISTS change_proposals (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,                       -- 'CREATE_RECRUITMENT' | 'UPDATE_RECRUITMENT'
    recruitment_id TEXT,                      -- target for updates, NULL for creates
    summary TEXT NOT NULL,
    payload TEXT NOT NULL,                    -- JSON: proposed fields (allowlisted)
    base_snapshot TEXT,                       -- JSON: current values of the proposed fields (before / stale guard)
    status TEXT NOT NULL DEFAULT 'PENDING',   -- 'PENDING' | 'APPLYING' | 'APPROVED' | 'REJECTED' | 'FAILED'
    proposed_by TEXT NOT NULL,
    decided_by TEXT,
    decided_at INTEGER,
    decision_note TEXT,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON change_proposals(status, created_at);
CREATE INDEX IF NOT EXISTS idx_proposals_recruitment ON change_proposals(recruitment_id);

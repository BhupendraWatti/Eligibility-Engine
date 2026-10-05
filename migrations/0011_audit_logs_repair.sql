-- 16. Repair: audit_logs was missing on the live DB (0001 was applied from an older revision). Idempotent.
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY NOT NULL,
    admin_email TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    field TEXT,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    source TEXT,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs(admin_email);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

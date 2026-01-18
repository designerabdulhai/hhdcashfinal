
-- ... existing code ...

-- 11. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Target user (Owner)
    type TEXT NOT NULL, -- BOOK_CREATED, ENTRY_ADDED, BOOK_ARCHIVED
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Helper to notify all owners
CREATE OR REPLACE FUNCTION notify_owners(p_type TEXT, p_message TEXT, p_payload JSONB)
RETURNS VOID AS $$
BEGIN
    INSERT INTO notifications (user_id, type, message, payload)
    SELECT id, p_type, p_message, p_payload
    FROM users
    WHERE role = 'OWNER';
END;
$$ LANGUAGE plpgsql;

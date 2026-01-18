-- ==========================================================
-- HhdCash Pro | Master Database Schema
-- Run this in your Supabase SQL Editor
-- ==========================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Users Table (Master Owner & Staff)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'EMPLOYEE',
    can_create_cashbooks BOOLEAN DEFAULT FALSE,
    can_archive_cashbooks BOOLEAN DEFAULT FALSE,
    profile_photo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Categories Table (Grouping for Cashbooks)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Cashbooks Table (The Ledgers)
CREATE TABLE IF NOT EXISTS cashbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'ACTIVE',
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Access Control List (Staff Permissions for Specific Books)
CREATE TABLE IF NOT EXISTS cashbook_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cashbook_id UUID REFERENCES cashbooks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    can_edit BOOLEAN DEFAULT TRUE,
    can_archive BOOLEAN DEFAULT FALSE,
    UNIQUE(cashbook_id, user_id)
);

-- 7. Financial Entries (The Transactions)
CREATE TABLE IF NOT EXISTS entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cashbook_id UUID REFERENCES cashbooks(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    description TEXT,
    payment_method TEXT DEFAULT 'CASH',
    attachment_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Performance Optimization Indices (Enhanced for Reporting)
CREATE INDEX IF NOT EXISTS idx_entries_cashbook_id ON entries(cashbook_id);
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_report_composite ON entries(cashbook_id, created_at, type);
CREATE INDEX IF NOT EXISTS idx_cashbooks_category_id ON cashbooks(category_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_staff_user_id ON cashbook_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 9. Advanced Reporting Function
-- Run this to enable ultra-fast reports grouped by time period
CREATE OR REPLACE FUNCTION get_cashflow_report(
    p_user_id UUID,
    p_is_admin BOOLEAN,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    cashbook_id UUID,
    cashbook_name TEXT,
    total_in NUMERIC,
    total_out NUMERIC,
    net_balance NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH user_books AS (
        SELECT cb.id, cb.name
        FROM cashbooks cb
        LEFT JOIN cashbook_staff cs ON cb.id = cs.cashbook_id
        WHERE (p_is_admin OR cs.user_id = p_user_id)
          AND (cb.is_deleted = FALSE OR cb.is_deleted IS NULL)
    )
    SELECT 
        ub.id,
        ub.name,
        COALESCE(SUM(CASE WHEN e.type = 'IN' THEN e.amount ELSE 0 END), 0)::NUMERIC as total_in,
        COALESCE(SUM(CASE WHEN e.type = 'OUT' THEN e.amount ELSE 0 END), 0)::NUMERIC as total_out,
        COALESCE(SUM(CASE WHEN e.type = 'IN' THEN e.amount WHEN e.type = 'OUT' THEN -e.amount ELSE 0 END), 0)::NUMERIC as net_balance
    FROM user_books ub
    LEFT JOIN entries e ON ub.id = e.cashbook_id 
        AND e.created_at >= p_start_date 
        AND e.created_at <= p_end_date
    GROUP BY ub.id, ub.name
    HAVING SUM(e.amount) > 0 OR COUNT(e.id) > 0;
END;
$$ LANGUAGE plpgsql;
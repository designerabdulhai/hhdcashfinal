-- 1. Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'EMPLOYEE',
    can_create_cashbooks BOOLEAN DEFAULT FALSE,
    can_archive_cashbooks BOOLEAN DEFAULT FALSE,
    profile_photo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Cashbooks Table
CREATE TABLE IF NOT EXISTS cashbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    owner_id UUID REFERENCES users(id),
    status TEXT DEFAULT 'ACTIVE',
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Cashbook Staff Table (Junction Table for Permissions)
CREATE TABLE IF NOT EXISTS cashbook_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cashbook_id UUID REFERENCES cashbooks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    can_edit BOOLEAN DEFAULT TRUE,
    can_archive BOOLEAN DEFAULT FALSE,
    UNIQUE(cashbook_id, user_id)
);

-- 6. Entries Table
CREATE TABLE IF NOT EXISTS entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cashbook_id UUID REFERENCES cashbooks(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    description TEXT,
    payment_method TEXT DEFAULT 'CASH',
    attachment_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- =====================================================
-- EliteMC Cooperative - Database Schema
-- Phase 1: Off-Chain with Blockchain-Ready Structure
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE kyc_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE deposit_status_enum AS ENUM ('PENDING', 'MATCHED', 'REJECTED');
CREATE TYPE ledger_direction_enum AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE property_status_enum AS ENUM ('DRAFT', 'OPEN', 'READY_TO_MINT', 'MINTED', 'CLOSED');
CREATE TYPE order_status_enum AS ENUM ('PENDING_PAYMENT', 'PAID', 'CANCELLED', 'FAILED');
CREATE TYPE allocation_status_enum AS ENUM ('RESERVED', 'SETTLED_OFFCHAIN', 'ONCHAIN_SETTLED', 'REVOKED');
CREATE TYPE mint_batch_status_enum AS ENUM ('PLANNED', 'SUBMITTED', 'CONFIRMED', 'FAILED');
CREATE TYPE payout_method_enum AS ENUM ('BANK_TRANSFER', 'INTERNAL_CREDIT');

-- =====================================================
-- TABLES
-- =====================================================

-- User Profiles
CREATE TABLE profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    kyc_status kyc_status_enum NOT NULL DEFAULT 'PENDING',
    wallet_ss58 TEXT, -- Polkadot SS58 address (blockchain-ready)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bank Deposit Submissions
CREATE TABLE bank_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    bank_ref TEXT NOT NULL, -- User's reference/transaction ID
    amount_mur NUMERIC(18,2) NOT NULL CHECK (amount_mur > 0),
    received_date DATE NOT NULL,
    proof_url TEXT, -- Storage URL for proof of payment
    status deposit_status_enum NOT NULL DEFAULT 'PENDING',
    matched_by UUID REFERENCES profiles(user_id), -- Admin who matched
    matched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fiat Balance (Internal MUR balance per user)
CREATE TABLE fiat_balances (
    user_id UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
    available NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (available >= 0),
    locked NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (locked >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fiat Ledger (Audit trail of all balance changes)
CREATE TABLE fiat_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    direction ledger_direction_enum NOT NULL,
    amount_mur NUMERIC(18,2) NOT NULL CHECK (amount_mur > 0),
    reason TEXT NOT NULL,
    ref_table TEXT, -- e.g., 'orders', 'bank_deposits', 'dividend_payouts'
    ref_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Properties
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    images JSONB DEFAULT '[]'::jsonb, -- Array of image URLs
    price_per_lot NUMERIC(18,2) NOT NULL CHECK (price_per_lot > 0),
    total_lots INTEGER NOT NULL CHECK (total_lots > 0),
    min_lot_purchase INTEGER NOT NULL DEFAULT 1 CHECK (min_lot_purchase > 0),
    target_raise_mur NUMERIC(18,2) GENERATED ALWAYS AS (price_per_lot * total_lots) STORED,
    status property_status_enum NOT NULL DEFAULT 'DRAFT',

    -- Blockchain-ready fields
    asset_hub_asset_id BIGINT, -- Polkadot Asset Hub asset ID
    decimals INTEGER DEFAULT 0,

    created_by UUID NOT NULL REFERENCES profiles(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders (Purchase intents)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    lots INTEGER NOT NULL CHECK (lots > 0),
    unit_price_mur NUMERIC(18,2) NOT NULL,
    total_price_mur NUMERIC(18,2) GENERATED ALWAYS AS (lots * unit_price_mur) STORED,
    status order_status_enum NOT NULL DEFAULT 'PENDING_PAYMENT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

-- Property Allocations (Cap table)
CREATE TABLE property_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    lots INTEGER NOT NULL CHECK (lots > 0),
    status allocation_status_enum NOT NULL DEFAULT 'RESERVED',
    order_id UUID REFERENCES orders(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Blockchain fields
    onchain_tx_hash TEXT,
    onchain_block BIGINT,

    UNIQUE(user_id, property_id, status) -- One active allocation per user per property
);

-- Token Mint Batches (Blockchain-ready)
CREATE TABLE token_mint_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    asset_id BIGINT NOT NULL, -- Asset Hub asset ID
    total_minted BIGINT NOT NULL,
    signer_wallet TEXT NOT NULL,
    extrinsic_hash TEXT,
    status mint_batch_status_enum NOT NULL DEFAULT 'PLANNED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

-- Token Transfers (Blockchain-ready)
CREATE TABLE token_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    asset_id BIGINT NOT NULL,
    amount BIGINT NOT NULL,
    extrinsic_hash TEXT,
    confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

-- Dividend Statements
CREATE TABLE dividend_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    gross_income_mur NUMERIC(18,2) NOT NULL,
    expenses_mur NUMERIC(18,2) NOT NULL DEFAULT 0,
    distributable_mur NUMERIC(18,2) GENERATED ALWAYS AS (gross_income_mur - expenses_mur) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES profiles(user_id)
);

-- Dividend Payouts
CREATE TABLE dividend_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    statement_id UUID NOT NULL REFERENCES dividend_statements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    amount_mur NUMERIC(18,2) NOT NULL CHECK (amount_mur > 0),
    payout_method payout_method_enum NOT NULL,
    payout_ref TEXT, -- Bank transfer ref or ledger ID
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID REFERENCES profiles(user_id),
    action TEXT NOT NULL,
    target_table TEXT,
    target_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_kyc_status ON profiles(kyc_status);

CREATE INDEX idx_bank_deposits_user ON bank_deposits(user_id);
CREATE INDEX idx_bank_deposits_status ON bank_deposits(status);
CREATE INDEX idx_bank_deposits_created ON bank_deposits(created_at DESC);

CREATE INDEX idx_fiat_ledger_user ON fiat_ledger(user_id);
CREATE INDEX idx_fiat_ledger_created ON fiat_ledger(created_at DESC);

CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_created ON properties(created_at DESC);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_property ON orders(property_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

CREATE INDEX idx_allocations_user ON property_allocations(user_id);
CREATE INDEX idx_allocations_property ON property_allocations(property_id);
CREATE INDEX idx_allocations_status ON property_allocations(status);

CREATE INDEX idx_dividend_payouts_statement ON dividend_payouts(statement_id);
CREATE INDEX idx_dividend_payouts_user ON dividend_payouts(user_id);

CREATE INDEX idx_audit_log_actor ON audit_log(actor_user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (current_setting('request.jwt.claims', true)::json->>'is_admin')::boolean,
        false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_deposits_updated_at
    BEFORE UPDATE ON bank_deposits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fiat_balances_updated_at
    BEFORE UPDATE ON fiat_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiat_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiat_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_mint_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividend_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividend_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    USING (is_admin());

CREATE POLICY "Admins can update all profiles"
    ON profiles FOR UPDATE
    USING (is_admin());

-- Bank Deposits RLS
CREATE POLICY "Users can view their own deposits"
    ON bank_deposits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deposits"
    ON bank_deposits FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all deposits"
    ON bank_deposits FOR SELECT
    USING (is_admin());

CREATE POLICY "Admins can update all deposits"
    ON bank_deposits FOR UPDATE
    USING (is_admin());

-- Fiat Balances RLS
CREATE POLICY "Users can view their own balance"
    ON fiat_balances FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage balances"
    ON fiat_balances FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Fiat Ledger RLS
CREATE POLICY "Users can view their own ledger"
    ON fiat_ledger FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can create ledger entries"
    ON fiat_ledger FOR INSERT
    WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Admins can view all ledger entries"
    ON fiat_ledger FOR SELECT
    USING (is_admin());

-- Properties RLS
CREATE POLICY "Anyone can view open properties"
    ON properties FOR SELECT
    USING (status = 'OPEN' OR is_admin());

CREATE POLICY "Admins can create properties"
    ON properties FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update properties"
    ON properties FOR UPDATE
    USING (is_admin());

CREATE POLICY "Admins can delete draft properties"
    ON properties FOR DELETE
    USING (is_admin() AND status = 'DRAFT');

-- Orders RLS
CREATE POLICY "Users can view their own orders"
    ON orders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders"
    ON orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders"
    ON orders FOR SELECT
    USING (is_admin());

-- Property Allocations RLS
CREATE POLICY "Users can view their own allocations"
    ON property_allocations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage allocations"
    ON property_allocations FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Admins can view all allocations"
    ON property_allocations FOR SELECT
    USING (is_admin());

-- Token Mint Batches RLS
CREATE POLICY "Admins can view all mint batches"
    ON token_mint_batches FOR ALL
    USING (is_admin());

-- Token Transfers RLS
CREATE POLICY "Users can view their own transfers"
    ON token_transfers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transfers"
    ON token_transfers FOR SELECT
    USING (is_admin());

CREATE POLICY "Service role can manage transfers"
    ON token_transfers FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Dividend Statements RLS
CREATE POLICY "Anyone can view dividend statements"
    ON dividend_statements FOR SELECT
    USING (true);

CREATE POLICY "Service role can manage statements"
    ON dividend_statements FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Dividend Payouts RLS
CREATE POLICY "Users can view their own payouts"
    ON dividend_payouts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can create payouts"
    ON dividend_payouts FOR INSERT
    WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Admins can view all payouts"
    ON dividend_payouts FOR SELECT
    USING (is_admin());

-- Audit Log RLS
CREATE POLICY "Admins can view audit log"
    ON audit_log FOR SELECT
    USING (is_admin());

CREATE POLICY "Service role can create audit entries"
    ON audit_log FOR INSERT
    WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- VIEWS
-- =====================================================

-- Property summary with allocation stats
CREATE OR REPLACE VIEW property_summary AS
SELECT
    p.id,
    p.title,
    p.location,
    p.price_per_lot,
    p.total_lots,
    p.target_raise_mur,
    p.status,
    COALESCE(SUM(pa.lots), 0)::INTEGER AS lots_sold,
    COALESCE(SUM(pa.lots * p.price_per_lot), 0) AS amount_raised,
    p.created_at,
    p.updated_at
FROM properties p
LEFT JOIN property_allocations pa ON p.id = pa.property_id
    AND pa.status IN ('RESERVED', 'SETTLED_OFFCHAIN', 'ONCHAIN_SETTLED')
GROUP BY p.id;

-- User portfolio
CREATE OR REPLACE VIEW user_portfolios AS
SELECT
    pa.user_id,
    pa.property_id,
    p.title AS property_title,
    p.location AS property_location,
    SUM(pa.lots) AS total_lots,
    p.price_per_lot,
    SUM(pa.lots * p.price_per_lot) AS total_invested,
    pa.status AS allocation_status,
    p.status AS property_status
FROM property_allocations pa
JOIN properties p ON pa.property_id = p.id
WHERE pa.status IN ('RESERVED', 'SETTLED_OFFCHAIN', 'ONCHAIN_SETTLED')
GROUP BY pa.user_id, pa.property_id, p.title, p.location, p.price_per_lot, pa.status, p.status;

-- =====================================================
-- INITIAL SETUP
-- =====================================================

COMMENT ON DATABASE postgres IS 'EliteMC Cooperative - Property Investment Platform';

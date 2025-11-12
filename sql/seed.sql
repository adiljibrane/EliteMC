-- =====================================================
-- EliteMC Cooperative - Seed Data
-- Demo data for local development and testing
-- =====================================================

-- WARNING: This script is for development only!
-- Do NOT run in production without modifying user IDs and sensitive data

-- NOTE: Before running this script, you need to:
-- 1. Create users via Supabase Auth (email OTP)
-- 2. Get their user IDs
-- 3. Replace the UUIDs below with actual user IDs
-- 4. Grant admin access via: UPDATE auth.users SET raw_app_meta_data = '{"is_admin": true}' WHERE email = 'admin@example.com';

-- =====================================================
-- STEP 1: Create demo user profiles
-- Replace these UUIDs with actual user IDs from auth.users
-- =====================================================

-- Admin user (replace with actual UUID)
INSERT INTO profiles (user_id, full_name, email, phone, kyc_status, wallet_ss58, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'Admin User', 'admin@elitemc.mu', '+230 5001 0001', 'APPROVED', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', NOW())
ON CONFLICT (user_id) DO NOTHING;

-- Regular users (replace with actual UUIDs)
INSERT INTO profiles (user_id, full_name, email, phone, kyc_status, wallet_ss58, created_at) VALUES
('00000000-0000-0000-0000-000000000002', 'Alice Dupont', 'alice@example.com', '+230 5002 0002', 'APPROVED', '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', NOW()),
('00000000-0000-0000-0000-000000000003', 'Bob Chen', 'bob@example.com', '+230 5003 0003', 'APPROVED', NULL, NOW()),
('00000000-0000-0000-0000-000000000004', 'Charlie Kumar', 'charlie@example.com', '+230 5004 0004', 'PENDING', NULL, NOW())
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- STEP 2: Create initial balances
-- =====================================================

INSERT INTO fiat_balances (user_id, available, locked) VALUES
('00000000-0000-0000-0000-000000000001', '1000000.00', '0.00'),
('00000000-0000-0000-0000-000000000002', '250000.00', '0.00'),
('00000000-0000-0000-0000-000000000003', '500000.00', '0.00'),
('00000000-0000-0000-0000-000000000004', '0.00', '0.00')
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- STEP 3: Create demo properties
-- =====================================================

INSERT INTO properties (id, title, location, description, images, price_per_lot, total_lots, min_lot_purchase, status, created_by, created_at) VALUES
(
    'prop-0001-0000-0000-0000-000000000001',
    'Luxury Beachfront Apartments',
    'Grand Baie, Mauritius',
    'Premium beachfront property with 24/7 security, infinity pool, and private beach access. High rental demand in tourist area.',
    '["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800"]'::jsonb,
    '50000.00',
    100,
    1,
    'OPEN',
    '00000000-0000-0000-0000-000000000001',
    NOW()
),
(
    'prop-0002-0000-0000-0000-000000000002',
    'City Center Office Complex',
    'Port Louis, Mauritius',
    'Modern office space in the heart of Port Louis. Fully leased to multinational corporations with stable rental income.',
    '["https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800"]'::jsonb,
    '75000.00',
    80,
    2,
    'OPEN',
    '00000000-0000-0000-0000-000000000001',
    NOW()
),
(
    'prop-0003-0000-0000-0000-000000000003',
    'Residential Villa Estate',
    'Flic en Flac, Mauritius',
    'Exclusive villa estate with ocean views. Perfect for families and retirees. Strong appreciation potential.',
    '["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800"]'::jsonb,
    '100000.00',
    50,
    1,
    'DRAFT',
    '00000000-0000-0000-0000-000000000001',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STEP 4: Create demo orders and allocations
-- =====================================================

-- Alice's orders
INSERT INTO orders (id, user_id, property_id, lots, unit_price_mur, status, created_at, paid_at) VALUES
('order-001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'prop-0001-0000-0000-0000-000000000001', 3, '50000.00', 'PAID', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
('order-002-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'prop-0002-0000-0000-0000-000000000002', 2, '75000.00', 'PAID', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- Bob's orders
INSERT INTO orders (id, user_id, property_id, lots, unit_price_mur, status, created_at, paid_at) VALUES
('order-003-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'prop-0001-0000-0000-0000-000000000001', 5, '50000.00', 'PAID', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days')
ON CONFLICT (id) DO NOTHING;

-- Allocations
INSERT INTO property_allocations (id, user_id, property_id, lots, status, order_id, created_at) VALUES
('alloc-001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'prop-0001-0000-0000-0000-000000000001', 3, 'SETTLED_OFFCHAIN', 'order-001-0000-0000-0000-000000000001', NOW() - INTERVAL '5 days'),
('alloc-002-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'prop-0002-0000-0000-0000-000000000002', 2, 'SETTLED_OFFCHAIN', 'order-002-0000-0000-0000-000000000002', NOW() - INTERVAL '3 days'),
('alloc-003-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'prop-0001-0000-0000-0000-000000000001', 5, 'SETTLED_OFFCHAIN', 'order-003-0000-0000-0000-000000000003', NOW() - INTERVAL '4 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STEP 5: Create demo bank deposits
-- =====================================================

INSERT INTO bank_deposits (id, user_id, bank_ref, amount_mur, received_date, proof_url, status, matched_by, matched_at, created_at) VALUES
(
    'deposit-001-0000-0000-0000-000000001',
    '00000000-0000-0000-0000-000000000002',
    'MCB-20250112-001',
    '250000.00',
    '2025-01-10',
    NULL,
    'MATCHED',
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '7 days'
),
(
    'deposit-002-0000-0000-0000-000000002',
    '00000000-0000-0000-0000-000000000003',
    'MCB-20250112-002',
    '500000.00',
    '2025-01-11',
    NULL,
    'MATCHED',
    '00000000-0000-0000-0000-000000000001',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '6 days'
),
(
    'deposit-003-0000-0000-0000-000000003',
    '00000000-0000-0000-0000-000000000004',
    'MCB-20250112-003',
    '100000.00',
    '2025-01-12',
    NULL,
    'PENDING',
    NULL,
    NULL,
    NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STEP 6: Create ledger entries
-- =====================================================

-- Alice's ledger
INSERT INTO fiat_ledger (user_id, direction, amount_mur, reason, ref_table, ref_id, created_at) VALUES
('00000000-0000-0000-0000-000000000002', 'CREDIT', '250000.00', 'Bank deposit matched - Ref: MCB-20250112-001', 'bank_deposits', 'deposit-001-0000-0000-0000-000000001', NOW() - INTERVAL '6 days'),
('00000000-0000-0000-0000-000000000002', 'DEBIT', '150000.00', 'Purchase of 3 lots for property', 'orders', 'order-001-0000-0000-0000-000000000001', NOW() - INTERVAL '5 days'),
('00000000-0000-0000-0000-000000000002', 'DEBIT', '150000.00', 'Purchase of 2 lots for property', 'orders', 'order-002-0000-0000-0000-000000000002', NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;

-- Bob's ledger
INSERT INTO fiat_ledger (user_id, direction, amount_mur, reason, ref_table, ref_id, created_at) VALUES
('00000000-0000-0000-0000-000000000003', 'CREDIT', '500000.00', 'Bank deposit matched - Ref: MCB-20250112-002', 'bank_deposits', 'deposit-002-0000-0000-0000-000000002', NOW() - INTERVAL '5 days'),
('00000000-0000-0000-0000-000000000003', 'DEBIT', '250000.00', 'Purchase of 5 lots for property', 'orders', 'order-003-0000-0000-0000-000000000003', NOW() - INTERVAL '4 days')
ON CONFLICT DO NOTHING;

-- =====================================================
-- STEP 7: Create demo dividend statement
-- =====================================================

INSERT INTO dividend_statements (id, property_id, period_start, period_end, gross_income_mur, expenses_mur, created_at, created_by) VALUES
(
    'dividend-001-0000-0000-0000-000001',
    'prop-0001-0000-0000-0000-000000000001',
    '2025-01-01',
    '2025-01-31',
    '50000.00',
    '5000.00',
    NOW() - INTERVAL '1 day',
    '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Demo dividend payouts (pro-rata based on allocations)
-- Total lots in property 1: 8 (Alice: 3, Bob: 5)
-- Distributable: 45,000 MUR
-- Alice's share: (3/8) * 45000 = 16,875
-- Bob's share: (5/8) * 45000 = 28,125

INSERT INTO dividend_payouts (id, statement_id, user_id, amount_mur, payout_method, payout_ref, created_at) VALUES
('payout-001-0000-0000-0000-000000001', 'dividend-001-0000-0000-0000-000001', '00000000-0000-0000-0000-000000000002', '16875.00', 'INTERNAL_CREDIT', NULL, NOW() - INTERVAL '1 day'),
('payout-002-0000-0000-0000-000000002', 'dividend-001-0000-0000-0000-000001', '00000000-0000-0000-0000-000000000003', '28125.00', 'INTERNAL_CREDIT', NULL, NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STEP 8: Create audit log entries
-- =====================================================

INSERT INTO audit_log (actor_user_id, action, target_table, target_id, details, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'match_deposit', 'bank_deposits', 'deposit-001-0000-0000-0000-000000001', '{"amount": 250000, "user_id": "00000000-0000-0000-0000-000000000002"}'::jsonb, NOW() - INTERVAL '6 days'),
('00000000-0000-0000-0000-000000000001', 'match_deposit', 'bank_deposits', 'deposit-002-0000-0000-0000-000000002', '{"amount": 500000, "user_id": "00000000-0000-0000-0000-000000000003"}'::jsonb, NOW() - INTERVAL '5 days'),
('00000000-0000-0000-0000-000000000002', 'capture_order', 'orders', 'order-001-0000-0000-0000-000000000001', '{"amount": 150000, "lots": 3}'::jsonb, NOW() - INTERVAL '5 days'),
('00000000-0000-0000-0000-000000000003', 'capture_order', 'orders', 'order-003-0000-0000-0000-000000000003', '{"amount": 250000, "lots": 5}'::jsonb, NOW() - INTERVAL '4 days'),
('00000000-0000-0000-0000-000000000001', 'calculate_dividends', 'dividend_statements', 'dividend-001-0000-0000-0000-000001', '{"distributable": 45000, "payouts_count": 2}'::jsonb, NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES (run these to verify seed data)
-- =====================================================

-- Check users
-- SELECT user_id, full_name, email, kyc_status FROM profiles;

-- Check balances
-- SELECT p.full_name, fb.available, fb.locked FROM fiat_balances fb JOIN profiles p ON fb.user_id = p.user_id;

-- Check properties
-- SELECT title, location, price_per_lot, total_lots, status FROM properties;

-- Check allocations
-- SELECT p.full_name, pr.title, pa.lots, pa.status FROM property_allocations pa
-- JOIN profiles p ON pa.user_id = p.user_id
-- JOIN properties pr ON pa.property_id = pr.id;

-- Check property summary
-- SELECT * FROM property_summary;

-- =====================================================
-- ADMIN USER SETUP (run this in Supabase SQL Editor)
-- =====================================================

-- To make a user admin, run this query in Supabase SQL Editor:
-- UPDATE auth.users SET raw_app_meta_data = jsonb_set(
--     COALESCE(raw_app_meta_data, '{}'::jsonb),
--     '{is_admin}',
--     'true'::jsonb
-- ) WHERE email = 'admin@elitemc.mu';

COMMENT ON TABLE profiles IS 'Seed data loaded successfully';

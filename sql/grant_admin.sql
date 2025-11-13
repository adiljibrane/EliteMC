-- Grant admin access to the first user (adil.goolab@panache.mu)
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
WHERE email = 'adil.goolab@panache.mu';

-- Verify the update
SELECT
    id,
    email,
    raw_app_meta_data->>'is_admin' as is_admin,
    created_at
FROM auth.users
WHERE email = 'adil.goolab@panache.mu';

-- Also ensure profile exists
INSERT INTO profiles (user_id, full_name, email, phone, kyc_status)
SELECT
    id,
    user_metadata->>'full_name',
    email,
    user_metadata->>'phone',
    'PENDING'
FROM auth.users
WHERE email = 'adil.goolab@panache.mu'
ON CONFLICT (user_id) DO UPDATE
SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;

-- Ensure fiat balance exists
INSERT INTO fiat_balances (user_id, available, locked)
SELECT id, 0, 0
FROM auth.users
WHERE email = 'adil.goolab@panache.mu'
ON CONFLICT (user_id) DO NOTHING;

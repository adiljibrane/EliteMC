-- Check if profile exists for the admin user
SELECT id, email FROM auth.users WHERE email = 'adil.goolab@panache.mu';

-- Create profile if it doesn't exist
INSERT INTO profiles (user_id, full_name, email, phone, kyc_status)
SELECT
    id,
    COALESCE(raw_user_meta_data->>'full_name', 'Admin User'),
    email,
    raw_user_meta_data->>'phone',
    'PENDING'
FROM auth.users
WHERE email = 'adil.goolab@panache.mu'
ON CONFLICT (user_id) DO UPDATE
SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = EXCLUDED.email,
    phone = COALESCE(EXCLUDED.phone, profiles.phone);

-- Ensure fiat balance exists
INSERT INTO fiat_balances (user_id, available, locked)
SELECT id, 0, 0
FROM auth.users
WHERE email = 'adil.goolab@panache.mu'
ON CONFLICT (user_id) DO NOTHING;

-- Verify everything is set up correctly
SELECT
    u.id,
    u.email,
    u.raw_app_meta_data->>'is_admin' as is_admin,
    p.full_name,
    p.kyc_status,
    fb.available as balance
FROM auth.users u
LEFT JOIN profiles p ON p.user_id = u.id
LEFT JOIN fiat_balances fb ON fb.user_id = u.id
WHERE u.email = 'adil.goolab@panache.mu';

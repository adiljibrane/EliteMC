# 🚀 Quick Reference Card - EliteMC Cooperative

## Essential Commands

### Supabase Commands
```bash
# Login
supabase login

# Link project
supabase link --project-ref xxxxx

# Deploy functions
supabase functions deploy capture_order
supabase functions deploy match_deposit
supabase functions deploy calculate_dividends

# Set secrets
supabase secrets set SUPABASE_URL=https://xxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxx

# View function logs
supabase functions logs capture_order
supabase functions logs match_deposit --tail

# List functions
supabase functions list

# Database backup
supabase db dump > backup.sql
```

### Local Development
```bash
# Start local server
npx serve frontend -p 8000

# Or with Python
python3 -m http.server 8000 --directory frontend

# Or use VS Code Live Server
```

### Deployment Commands
```bash
# Deploy to Vercel
cd frontend
vercel --prod

# Deploy to Netlify
netlify deploy --prod --dir=frontend

# Quick deploy script
./scripts/deploy.sh
```

### Git Commands
```bash
# Commit changes
git add .
git commit -m "feat: description"
git push origin branch-name

# Create production backup
git checkout -b production-backup
git push -u origin production-backup
```

---

## Important URLs

**Development:**
- Local: `http://localhost:8000`
- Supabase Local: `http://localhost:54321`

**Production:**
- Frontend: `https://your-site.vercel.app`
- Supabase Dashboard: `https://supabase.com/dashboard/project/xxxxx`
- Admin Panel: `https://your-site.vercel.app/admin/dashboard.html`

---

## SQL Quick Queries

### Make User Admin
```sql
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{is_admin}',
    'true'::jsonb
)
WHERE email = 'admin@example.com';
```

### Check Admin Status
```sql
SELECT
  email,
  raw_app_meta_data->>'is_admin' as is_admin
FROM auth.users
WHERE email = 'admin@example.com';
```

### View All Users
```sql
SELECT
  au.email,
  p.full_name,
  p.kyc_status,
  fb.available as balance
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.user_id
LEFT JOIN fiat_balances fb ON au.id = fb.user_id
ORDER BY au.created_at DESC;
```

### View Property Summary
```sql
SELECT * FROM property_summary
ORDER BY created_at DESC;
```

### View User Portfolio
```sql
SELECT * FROM user_portfolios
WHERE user_id = 'user-uuid-here';
```

### Check Balance Integrity
```sql
SELECT
  user_id,
  available + locked as total_balance,
  (SELECT SUM(amount_mur) FROM fiat_ledger WHERE direction = 'CREDIT' AND fiat_ledger.user_id = fiat_balances.user_id) as total_credits,
  (SELECT SUM(amount_mur) FROM fiat_ledger WHERE direction = 'DEBIT' AND fiat_ledger.user_id = fiat_balances.user_id) as total_debits
FROM fiat_balances;
```

### View Recent Audit Log
```sql
SELECT
  al.created_at,
  p.email as actor,
  al.action,
  al.target_table,
  al.details
FROM audit_log al
LEFT JOIN profiles p ON al.actor_user_id = p.user_id
ORDER BY al.created_at DESC
LIMIT 20;
```

### Reset User Balance (DEV ONLY)
```sql
-- DO NOT USE IN PRODUCTION
UPDATE fiat_balances
SET available = 100000, locked = 0
WHERE user_id = 'user-uuid-here';
```

---

## Common Edge Function Tests

### Test capture_order
```bash
curl -X POST \
  https://xxxxx.supabase.co/functions/v1/capture_order \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order-uuid-here",
    "idempotency_key": "test-key-123"
  }'
```

### Test match_deposit
```bash
curl -X POST \
  https://xxxxx.supabase.co/functions/v1/match_deposit \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "bank_deposit_id": "deposit-uuid-here",
    "action": "MATCH",
    "notes": "Test match"
  }'
```

### Test calculate_dividends
```bash
curl -X POST \
  https://xxxxx.supabase.co/functions/v1/calculate_dividends \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": "property-uuid-here",
    "period_start": "2025-01-01",
    "period_end": "2025-01-31",
    "gross_income_mur": 10000,
    "expenses_mur": 1000,
    "payout_method": "INTERNAL_CREDIT"
  }'
```

---

## Troubleshooting Quick Fixes

### "Failed to fetch" Error
1. Check browser console for specific error
2. Verify Supabase URL in `frontend/js/supabaseClient.js`
3. Check CORS settings in Supabase dashboard
4. Verify Edge Functions are deployed: `supabase functions list`

### Admin Panel Not Accessible
```sql
-- Re-grant admin access
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{is_admin}',
    'true'::jsonb
)
WHERE email = 'your-email@example.com';
```
Then hard refresh browser (Ctrl+Shift+R)

### Balance Not Updating
1. Check Edge Function logs: `supabase functions logs capture_order`
2. Verify service role key: `supabase secrets list`
3. Check RLS policies are correct
4. Verify fiat_balances record exists

### Magic Link Not Working
1. Check Supabase Auth → URL Configuration
2. Verify redirect URLs include your production domain
3. Check email spam folder
4. Try with a different email provider

### Deployment Fails
```bash
# Clear Vercel cache
vercel --prod --force

# Re-link Supabase project
supabase link --project-ref xxxxx

# Re-deploy functions
supabase functions deploy capture_order --no-verify-jwt
```

---

## File Locations Cheat Sheet

### Configuration Files
- Frontend config: `frontend/js/supabaseClient.js`
- Edge Function env: `supabase/.env`
- Vercel config: `vercel.json`
- Netlify config: `netlify.toml`

### Database Files
- Schema: `sql/schema.sql`
- Seed data: `sql/seed.sql`
- Storage policies: `sql/storage_policies.sql`

### Edge Functions
- Capture order: `supabase/functions/capture_order/index.ts`
- Match deposit: `supabase/functions/match_deposit/index.ts`
- Calculate dividends: `supabase/functions/calculate_dividends/index.ts`

### Frontend Pages
- Homepage: `frontend/index.html`
- Login: `frontend/login.html`
- Properties: `frontend/properties.html`
- Property detail: `frontend/property.html`
- Wallet: `frontend/wallet.html`
- Orders: `frontend/orders.html`
- Admin dashboard: `frontend/admin/dashboard.html`
- Admin deposits: `frontend/admin/deposits.html`
- Admin properties: `frontend/admin/properties.html`
- Admin dividends: `frontend/admin/dividends.html`
- Mint prep: `frontend/admin/mint-prep.html`

### JavaScript Modules
- Supabase client: `frontend/js/supabaseClient.js`
- UI utilities: `frontend/js/ui.js`
- Authentication: `frontend/js/auth.js`
- Properties: `frontend/js/properties.js`
- Property detail: `frontend/js/property-detail.js`
- Wallet: `frontend/js/wallet.js`
- Orders: `frontend/js/orders.js`
- Admin utils: `frontend/js/admin.js`
- Admin deposits: `frontend/js/deposits-admin.js`
- Admin dividends: `frontend/js/dividends-admin.js`
- Mint prep: `frontend/js/mint-prep.js`

---

## Environment Variables Checklist

### Frontend (.env or direct in code)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### Edge Functions (Supabase Secrets)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Optional
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `SENTRY_DSN`
- `PAYMENT_GATEWAY_KEY`
- `SMS_API_KEY`

---

## Key Security Settings

### Authentication
- ✅ Email confirmations enabled
- ✅ Rate limits configured
- ✅ CAPTCHA enabled (production)
- ✅ Magic link expiry: 1 hour
- ✅ JWT expiry: 1 hour

### Database
- ✅ RLS enabled on all tables
- ✅ Service role for money operations only
- ✅ Admin access via JWT claim
- ✅ Audit logging enabled

### Storage
- ✅ RLS enabled
- ✅ Public buckets for images
- ✅ Size limits enforced
- ✅ MIME type restrictions

### Headers
- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff
- ✅ X-XSS-Protection enabled
- ✅ Referrer-Policy configured

---

## Support Resources

- **Main Documentation**: `README.md`
- **Deployment Guide**: `DEPLOYMENT.md`
- **This Quick Reference**: `QUICKREF.md`
- **Supabase Docs**: https://supabase.com/docs
- **Polkadot.js Docs**: https://polkadot.js.org/docs/
- **Tailwind CSS**: https://tailwindcss.com/docs

---

**Last Updated**: 2025-01-12
**Version**: 1.0.0
**Status**: Production Ready ✅

# Deploy Edge Functions to Supabase

## Quick Deploy via Dashboard (Recommended - 5 minutes)

### Option 1: Dashboard Upload (Easiest)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard/project/riizybdrtikrcnrztcme
   - Navigate to: **Edge Functions** (left sidebar)

2. **Deploy capture_order function**
   - Click "Create a new function"
   - Name: `capture_order`
   - Copy/paste content from: `supabase/functions/capture_order/index.ts`
   - Click "Deploy function"

3. **Deploy match_deposit function**
   - Click "Create a new function"
   - Name: `match_deposit`
   - Copy/paste content from: `supabase/functions/match_deposit/index.ts`
   - Click "Deploy function"

4. **Deploy calculate_dividends function**
   - Click "Create a new function"
   - Name: `calculate_dividends`
   - Copy/paste content from: `supabase/functions/calculate_dividends/index.ts`
   - Click "Deploy function"

5. **Environment Secrets** ✅ NOT NEEDED!
   Supabase **automatically provides** these environment variables to all Edge Functions:
   - `SUPABASE_URL` - Your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key
   - `SUPABASE_ANON_KEY` - Anonymous key

   **You don't need to set any secrets manually!** Skip this step.

---

## Option 2: Deploy via CLI (Advanced - 10 minutes)

### Step 1: Get Personal Access Token

1. Go to: https://supabase.com/dashboard/account/tokens
2. Click "Generate new token"
3. Name it: "EliteMC CLI"
4. Copy the token (starts with `sbp_`)

### Step 2: Install Supabase CLI

```bash
# Already installed at /tmp/supabase
# Or download fresh:
curl -L https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz -o /tmp/supabase.tar.gz
tar -xzf /tmp/supabase.tar.gz -C /tmp
chmod +x /tmp/supabase
```

### Step 3: Login and Link

```bash
# Set your personal access token
export SUPABASE_ACCESS_TOKEN="sbp_your_token_here"

# Link the project
/tmp/supabase link --project-ref riizybdrtikrcnrztcme
```

### Step 4: Deploy All Functions

```bash
# Deploy all functions at once
/tmp/supabase functions deploy capture_order
/tmp/supabase functions deploy match_deposit
/tmp/supabase functions deploy calculate_dividends

# Or deploy all at once
/tmp/supabase functions deploy
```

### Step 5: Secrets (Not Needed)

✅ **Supabase automatically provides environment variables** - no manual secrets needed!

---

## Verify Deployment

### Test capture_order

```bash
curl -X POST \
  'https://riizybdrtikrcnrztcme.supabase.co/functions/v1/capture_order' \
  -H 'Authorization: Bearer YOUR_USER_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "order_id": "test-order-id",
    "idempotency_key": "test-key-123"
  }'
```

### Test match_deposit

```bash
curl -X POST \
  'https://riizybdrtikrcnrztcme.supabase.co/functions/v1/match_deposit' \
  -H 'Authorization: Bearer YOUR_USER_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "deposit_id": "test-deposit-id"
  }'
```

### Test calculate_dividends

```bash
curl -X POST \
  'https://riizybdrtikrcnrztcme.supabase.co/functions/v1/calculate_dividends' \
  -H 'Authorization: Bearer YOUR_USER_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "property_id": "test-property-id",
    "total_dividend_mur": "10000.00",
    "apply_to_balances": false
  }'
```

---

## Function URLs

After deployment, your functions will be available at:

- **capture_order**: `https://riizybdrtikrcnrztcme.supabase.co/functions/v1/capture_order`
- **match_deposit**: `https://riizybdrtikrcnrztcme.supabase.co/functions/v1/match_deposit`
- **calculate_dividends**: `https://riizybdrtikrcnrztcme.supabase.co/functions/v1/calculate_dividends`

---

## Troubleshooting

### "Function not found" error
- Make sure you deployed the function
- Check the function name matches exactly
- Wait 30 seconds after deployment for propagation

### "Invalid secrets" error
- Verify you set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
- Check for typos in the secrets
- Redeploy the function after setting secrets

### "Authorization required" error
- You need to pass a valid user JWT in the Authorization header
- Get it from: `supabase.auth.getSession()` in the frontend
- Format: `Authorization: Bearer eyJhbGc...`

---

## Next Steps After Deployment

1. ✅ Edge Functions deployed
2. ⏭️ Create admin user (see README.md)
3. ⏭️ Test complete user flow
4. ⏭️ Update Supabase Auth redirect URLs
5. ⏭️ Final production deployment

---

**Status**: Ready to deploy! Choose Option 1 (Dashboard) for quickest deployment.

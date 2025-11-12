# 🚀 Complete Deployment Guide - EliteMC Cooperative

## Prerequisites Checklist

Before starting, ensure you have:
- [ ] Supabase account (free tier is fine)
- [ ] GitHub account
- [ ] Vercel or Netlify account (for frontend hosting)
- [ ] Node.js 18+ installed
- [ ] Supabase CLI installed: `npm install -g supabase`
- [ ] Git installed

---

## Part 1: Supabase Backend Setup (20 minutes)

### Step 1: Create Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in:
   - **Name**: `elitemc-production`
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to Mauritius (Singapore or Mumbai)
   - **Pricing Plan**: Free (or Pro if needed)
4. Click **"Create new project"**
5. Wait 2-3 minutes for provisioning

### Step 2: Get Your Credentials

1. In your project dashboard, go to **Settings** → **API**
2. Copy and save these values:
   ```
   Project URL: https://xxxxx.supabase.co
   anon/public key: eyJhbGc...
   service_role key: eyJhbGc... (keep this SECRET!)
   ```

### Step 3: Run Database Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Open your local `sql/schema.sql` file
4. Copy the ENTIRE contents
5. Paste into SQL Editor
6. Click **"Run"** (bottom right)
7. Wait for success message: ✅ "Success. No rows returned"

**Verify it worked:**
```sql
-- Run this query to check tables were created:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```
You should see: `audit_log`, `bank_deposits`, `dividend_payouts`, etc.

### Step 4: Create Storage Buckets

1. Go to **Storage** in left sidebar
2. Click **"Create a new bucket"**

**Bucket 1: bank-proofs**
- Name: `bank-proofs`
- Public bucket: ✅ **Yes**
- File size limit: 5 MB
- Allowed MIME types: `image/*,application/pdf`
- Click **"Create bucket"**

**Bucket 2: property-images**
- Name: `property-images`
- Public bucket: ✅ **Yes**
- File size limit: 10 MB
- Allowed MIME types: `image/*`
- Click **"Create bucket"**

### Step 5: Set Storage Policies

For each bucket, go to **Policies** tab:

**For bank-proofs:**
```sql
-- Policy 1: Public read
CREATE POLICY "Public can view proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'bank-proofs');

-- Policy 2: Authenticated users can upload
CREATE POLICY "Authenticated users can upload proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'bank-proofs' AND
  auth.role() = 'authenticated'
);
```

**For property-images:**
```sql
-- Policy 1: Public read
CREATE POLICY "Public can view property images"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-images');

-- Policy 2: Admins can upload
CREATE POLICY "Admins can upload property images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'property-images' AND
  auth.role() = 'authenticated'
);
```

### Step 6: Configure Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider (should be on by default)
3. Go to **Authentication** → **Email Templates**
4. Customize the "Magic Link" template (optional):

```html
<h2>Sign in to EliteMC Cooperative</h2>
<p>Click the link below to sign in:</p>
<p><a href="{{ .ConfirmationURL }}">Sign In</a></p>
<p>Or copy this link: {{ .ConfirmationURL }}</p>
<p>This link expires in 1 hour.</p>
```

5. Go to **Authentication** → **URL Configuration**
6. Add your site URL (we'll update this after frontend deployment):
   - For now: `http://localhost:8000`

### Step 7: Deploy Edge Functions

Open terminal in your project directory:

```bash
# 1. Login to Supabase
supabase login

# 2. Link your project (replace xxxxx with your project ref)
supabase link --project-ref xxxxx

# 3. Deploy each function
supabase functions deploy capture_order
supabase functions deploy match_deposit
supabase functions deploy calculate_dividends

# 4. Set environment secrets
supabase secrets set SUPABASE_URL=https://xxxxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 5. Verify deployment
supabase functions list
```

**Expected output:**
```
┌─────────────────────────┬──────────────┬─────────────────┐
│ NAME                    │ STATUS       │ VERSION         │
├─────────────────────────┼──────────────┼─────────────────┤
│ capture_order           │ ACTIVE       │ latest          │
│ match_deposit           │ ACTIVE       │ latest          │
│ calculate_dividends     │ ACTIVE       │ latest          │
└─────────────────────────┴──────────────┴─────────────────┘
```

**Test an Edge Function:**
```bash
curl -i --location --request POST \
  'https://xxxxx.supabase.co/functions/v1/capture_order' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"order_id":"test"}'

# Should return 401 or validation error (that's good!)
```

---

## Part 2: Frontend Configuration (5 minutes)

### Step 8: Update Frontend Configuration

1. Open `frontend/js/supabaseClient.js`
2. Replace placeholders with your actual credentials:

```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co'  // Your project URL
const SUPABASE_ANON_KEY = 'eyJhbGc...'            // Your anon key
```

3. Save the file
4. Commit the change:
```bash
git add frontend/js/supabaseClient.js
git commit -m "chore: Update Supabase credentials for production"
```

### Step 9: Test Locally

```bash
# Option 1: Using npx serve (recommended)
npx serve frontend -p 8000

# Option 2: Using Python
python3 -m http.server 8000 --directory frontend

# Option 3: Using VS Code Live Server
# Right-click frontend/index.html → "Open with Live Server"
```

Open browser: `http://localhost:8000`

**Quick Test Checklist:**
- [ ] Homepage loads with proper styling
- [ ] Can navigate to Login page
- [ ] Can navigate to Properties page
- [ ] No console errors (check DevTools)

---

## Part 3: Production Deployment (15 minutes)

### Step 10: Deploy Frontend to Vercel

**Option A: Deploy via Vercel Dashboard**

1. Go to [https://vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click **"Add New Project"**
4. Import your `EliteMC` repository
5. Configure build settings:
   ```
   Framework Preset: Other
   Root Directory: frontend
   Build Command: (leave empty)
   Output Directory: (leave empty)
   Install Command: (leave empty)
   ```
6. Click **"Deploy"**
7. Wait 2-3 minutes
8. Copy your deployment URL: `https://elitemc.vercel.app`

**Option B: Deploy via Vercel CLI**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel --prod

# Follow prompts:
# - Set up and deploy: Y
# - Which scope: Your username
# - Link to existing project: N
# - Project name: elitemc
# - Directory: ./
# - Override settings: N
```

**Alternative: Deploy to Netlify**

1. Go to [https://netlify.com](https://netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect to GitHub → Select `EliteMC` repo
4. Build settings:
   ```
   Base directory: frontend
   Build command: (leave empty)
   Publish directory: (leave empty - it's the root)
   ```
5. Click **"Deploy site"**
6. Copy your URL: `https://elitemc.netlify.app`

### Step 11: Update Supabase Redirect URLs

1. Go back to Supabase Dashboard
2. Go to **Authentication** → **URL Configuration**
3. Update **Site URL**: `https://elitemc.vercel.app` (your production URL)
4. Add to **Redirect URLs**:
   ```
   https://elitemc.vercel.app/**
   https://elitemc.vercel.app/frontend/properties.html
   http://localhost:8000/** (keep for local dev)
   ```
5. Click **"Save"**

### Step 12: Update Frontend Redirect URL

Update `frontend/js/auth.js` if needed:
```javascript
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: 'https://elitemc.vercel.app/properties.html', // Update this
  },
})
```

Commit and push:
```bash
git add frontend/js/auth.js
git commit -m "chore: Update production redirect URL"
git push
```

Vercel will auto-deploy the changes in ~1 minute.

---

## Part 4: Create Admin User (5 minutes)

### Step 13: Register First User

1. Go to your production site: `https://elitemc.vercel.app`
2. Click **"Sign In"** → **"Sign Up"** tab
3. Fill in:
   - Full Name: `Admin User`
   - Email: `admin@elitemc.mu` (use your real email)
   - Phone: Your phone number
4. Click **"Create Account"**
5. Check your email
6. Click the magic link
7. You'll be redirected and logged in

### Step 14: Grant Admin Access

1. Go to Supabase Dashboard → **SQL Editor**
2. Run this query (replace email):

```sql
-- Make user an admin
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{is_admin}',
    'true'::jsonb
)
WHERE email = 'admin@elitemc.mu';

-- Verify admin status
SELECT
  id,
  email,
  raw_app_meta_data->>'is_admin' as is_admin,
  created_at
FROM auth.users
WHERE email = 'admin@elitemc.mu';
```

3. Refresh your browser
4. You should now see **"Admin"** link in navigation

### Step 15: Load Seed Data (Optional)

If you want demo data for testing:

1. First, get your user UUIDs:
```sql
SELECT id, email FROM auth.users ORDER BY created_at;
```

2. Open `sql/seed.sql`
3. Replace all the UUID placeholders with actual user IDs
4. Run the modified script in SQL Editor

---

## Part 5: Final Configuration (10 minutes)

### Step 16: Create First Property

1. Go to **Admin** → **Properties**
2. Fill in form:
   ```
   Title: Luxury Beachfront Apartment
   Location: Grand Baie, Mauritius
   Description: Premium beachfront property with ocean views...
   Price per Lot: 50000
   Total Lots: 100
   Min Lot Purchase: 1
   Status: OPEN
   ```
3. Click **"Create Property"**
4. Verify it appears on homepage

### Step 17: Test Complete Flow

**As Regular User:**

1. Sign out (if logged in as admin)
2. Sign up new account: `test@example.com`
3. Go to **Wallet**
4. Submit a bank deposit:
   - Bank Ref: `TEST-12345`
   - Amount: `100000`
   - Date: Today
   - Upload a test image (screenshot is fine)
5. Click **"Submit Deposit"**

**As Admin:**

1. Log back in as admin
2. Go to **Admin** → **Deposits**
3. You should see the pending deposit
4. Click **"Match"** → Confirm
5. Verify deposit status changed to "MATCHED"

**As Regular User Again:**

1. Log back in as test user
2. Go to **Wallet**
3. Verify balance shows MUR 100,000
4. Go to **Properties**
5. Click on your property
6. Buy 2 lots (MUR 100,000)
7. Go to **Orders** - verify order shows as "PAID"
8. Go to **Wallet** - verify balance decreased

**As Admin - Dividends:**

1. Log in as admin
2. Go to **Admin** → **Dividends**
3. Create dividend statement:
   - Property: Your property
   - Period: This month
   - Gross Income: 10000
   - Expenses: 1000
   - Payout Method: Internal Credit
4. Click **"Preview Distribution"**
5. Click **"Confirm & Distribute"**
6. Log back in as test user → Wallet → Verify dividend received

---

## Part 6: Security Hardening (10 minutes)

### Step 18: Enable Additional Security

**Enable RLS on Storage:**

```sql
-- In Supabase SQL Editor
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
```

**Enable Email Confirmations:**

1. Go to **Authentication** → **Settings**
2. Enable **"Enable email confirmations"**
3. Save changes

**Set Rate Limits:**

1. Go to **Authentication** → **Rate Limits**
2. Configure:
   ```
   Email sign ups per hour: 10
   Sign in attempts per hour: 20
   Password recovery per hour: 5
   ```

**Enable CAPTCHA (Recommended for production):**

1. Go to [https://www.google.com/recaptcha/admin](https://www.google.com/recaptcha/admin)
2. Create new site (reCAPTCHA v2 Invisible)
3. Copy Site Key and Secret Key
4. In Supabase: **Authentication** → **Settings**
5. Scroll to **CAPTCHA Protection**
6. Enter keys
7. Enable for: Sign Up, Sign In, Password Recovery

### Step 19: Configure Email Settings (Optional)

For production, use a custom SMTP server:

1. Get SMTP credentials from:
   - SendGrid (free tier: 100 emails/day)
   - Mailgun
   - AWS SES
   - Postmark

2. In Supabase: **Settings** → **Email**
3. Click **"Enable Custom SMTP"**
4. Enter your SMTP settings
5. Test the connection

### Step 20: Set Up Monitoring

**Enable Supabase Logs:**

1. Go to **Logs** in Supabase Dashboard
2. Enable:
   - Database logs
   - Edge Function logs
   - API logs

**Set Up Alerts (Optional):**

Consider adding:
- [Sentry](https://sentry.io) for error tracking
- [UptimeRobot](https://uptimerobot.com) for uptime monitoring
- [LogRocket](https://logrocket.com) for session replay

Add to your HTML files:
```html
<!-- In <head> section -->
<script src="https://browser.sentry-cdn.com/7.x.x/bundle.min.js"></script>
<script>
  Sentry.init({
    dsn: "your-sentry-dsn",
    environment: "production"
  });
</script>
```

---

## Part 7: Custom Domain (Optional, 10 minutes)

### Step 21: Add Custom Domain

**In Vercel:**

1. Go to your project → **Settings** → **Domains**
2. Add domain: `elitemc.mu` (your actual domain)
3. Follow DNS configuration instructions
4. Add these DNS records to your domain provider:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

5. Wait for DNS propagation (5-60 minutes)
6. Vercel will auto-provision SSL certificate

**Update Supabase Redirect URLs:**

Add `https://elitemc.mu` to allowed redirect URLs in Supabase.

---

## Part 8: Backup Strategy (5 minutes)

### Step 22: Set Up Backups

**Automatic Backups:**

Supabase automatically backs up your database daily (Pro plan) or weekly (Free plan).

**Manual Backup:**

```bash
# Export database schema
supabase db dump --schema public > backup-$(date +%Y%m%d).sql

# Or via SQL:
# Go to Supabase Dashboard → Database → Backups
# Click "Create backup"
```

**GitHub Backups:**

Your code is already backed up on GitHub. Create a backup branch:

```bash
git checkout -b production-backup
git push -u origin production-backup
```

---

## 📋 Post-Deployment Checklist

- [ ] Supabase project created and configured
- [ ] Database schema deployed successfully
- [ ] Storage buckets created with correct policies
- [ ] Edge Functions deployed and tested
- [ ] Frontend deployed to Vercel/Netlify
- [ ] Admin user created and verified
- [ ] Test property created
- [ ] Complete user flow tested (deposit → purchase → dividend)
- [ ] Authentication working with magic links
- [ ] Custom domain configured (if applicable)
- [ ] Security features enabled (rate limits, RLS)
- [ ] Monitoring set up
- [ ] Backup strategy implemented
- [ ] Documentation updated with production URLs

---

## 🎯 Production URLs to Save

```
Frontend: https://elitemc.vercel.app
Supabase Dashboard: https://supabase.com/dashboard/project/xxxxx
Admin Panel: https://elitemc.vercel.app/admin/dashboard.html
```

---

## 🔥 Common Issues & Fixes

### Issue: "Failed to fetch" errors

**Fix:**
1. Check browser console for CORS errors
2. Verify Supabase URL and keys in `supabaseClient.js`
3. Check Edge Function is deployed: `supabase functions list`

### Issue: Magic link doesn't work

**Fix:**
1. Check redirect URLs in Supabase Auth settings
2. Verify production URL is added
3. Check email spam folder

### Issue: Admin menu not showing

**Fix:**
```sql
-- Re-run admin grant:
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{is_admin}',
    'true'::jsonb
)
WHERE email = 'your-admin@email.com';
```

Then hard refresh browser (Ctrl+Shift+R)

### Issue: Deposit matching fails

**Fix:**
1. Check Edge Function logs: `supabase functions logs match_deposit`
2. Verify service role key is set: `supabase secrets list`
3. Check user has fiat_balances record

---

## 🚀 You're Live!

Your EliteMC Cooperative platform is now live and production-ready!

**Next Steps:**
1. Share the URL with beta testers
2. Create 2-3 real properties
3. Monitor error logs for the first week
4. Gather user feedback
5. Plan Phase 2: Blockchain integration

**Need help?** Review the main README.md for detailed documentation.

---

**Deployment Time Estimate:**
- Backend setup: 20 min
- Frontend config: 5 min
- Production deploy: 15 min
- Admin setup: 5 min
- Testing: 10 min
- Security: 10 min
- **Total: ~65 minutes** ⏱️

Congratulations! 🎊

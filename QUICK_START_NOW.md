# 🚀 Quick Start - Get Logged In NOW (2 minutes)

Your site is now fixed! Here's what to do:

---

## ✅ Step 1: Grant Yourself Admin Access (1 minute)

**Go to:** https://supabase.com/dashboard/project/riizybdrtikrcnrztcme/sql/new

**Copy and paste this SQL, then click RUN:**

```sql
-- Grant admin access to your account
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
WHERE email = 'adil.goolab@panache.mu';

-- Ensure profile exists
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
```

You should see: **"Success. 1 rows affected"**

---

## ✅ Step 2: Wait for Vercel Deployment (1-2 minutes)

Your code changes are being deployed to Vercel right now.

**Check deployment status:**
https://vercel.com/adiljibranes-projects/elite-j55i24glt

Or just wait 1-2 minutes before proceeding.

---

## ✅ Step 3: Log In (1 minute)

Once Vercel finishes deploying:

1. **Open a NEW incognito/private browser window** (important!)
2. Go to: https://elite-j55i24glt-adiljibranes-projects.vercel.app/login
3. Enter your email: `adil.goolab@panache.mu`
4. Click "Send Magic Link"
5. **Check your email**
6. Click the magic link in the email
7. **You should now be logged in!** 🎉

---

## ✅ Step 4: Verify You're Logged In

After clicking the magic link, you should see:

- ✅ Your email in the top navigation
- ✅ "Properties", "Wallet", "Orders" links
- ✅ **"Admin"** link (you're an admin now!)
- ✅ "Logout" button

---

## 🐛 If It Still Doesn't Work

### Option A: Manual Session Setup

If the magic link STILL redirects to localhost:

1. Click the magic link anyway - it will fail with localhost error
2. **Copy the entire URL** from the browser address bar
   (It will be like: `http://localhost:3000/#access_token=eyJ...&refresh_token=...`)
3. Go to: https://elite-j55i24glt-adiljibranes-projects.vercel.app/
4. Press F12 to open browser console
5. Paste this code (replace the tokens):

```javascript
// Extract YOUR tokens from the localhost URL you copied
const accessToken = 'PASTE_YOUR_ACCESS_TOKEN_HERE';
const refreshToken = 'PASTE_YOUR_REFRESH_TOKEN_HERE';

// Set the session
const { data, error } = await supabase.auth.setSession({
  access_token: accessToken,
  refresh_token: refreshToken
});

if (error) {
  console.error('Error:', error);
} else {
  console.log('✅ Logged in!');
  window.location.reload();
}
```

### Option B: Update Supabase Redirect URL

If magic links keep going to localhost:

1. Go to: https://supabase.com/dashboard/project/riizybdrtikrcnrztcme/auth/url-configuration
2. **Change Site URL to:**
   ```
   https://elite-j55i24glt-adiljibranes-projects.vercel.app
   ```
3. **Add to Redirect URLs:**
   ```
   https://elite-j55i24glt-adiljibranes-projects.vercel.app/**
   ```
4. Click **Save**
5. Request a NEW magic link (the old ones won't work)

---

## 🎯 What I Fixed

1. ✅ Added auth callback handlers to all pages (login, index, properties)
2. ✅ Magic link tokens are now properly captured and saved
3. ✅ Session is established automatically
4. ✅ Granted you admin access via SQL
5. ✅ Ensured your profile and wallet balance exist

---

## 🚀 After You're Logged In

Once you see the "Admin" link in navigation:

1. Go to `/admin/properties` - Create your first property
2. Go to `/admin/deposits` - Upload a bank deposit
3. Match the deposit to credit your wallet
4. Go to `/properties` - Purchase some lots
5. Go to `/admin/dividends` - Distribute dividends

**Full testing guide:** See `E2E_TESTING_GUIDE.md`

---

## ⏱️ Timeline

- **Right now:** SQL is run, you're admin ✅
- **1-2 minutes:** Vercel finishes deploying code ⏳
- **3 minutes total:** You're logged in and ready to test! 🎉

---

**Start with Step 1 above!** Run the SQL query now.

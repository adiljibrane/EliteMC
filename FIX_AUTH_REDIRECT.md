# 🔧 Fix Authentication Redirect Issue

## Problem
Magic link redirects to `http://localhost:3000` instead of your Vercel site.

---

## ✅ Solution: Update Supabase Auth Settings (2 minutes)

### Step 1: Go to Supabase Auth Configuration

**Direct link:** https://supabase.com/dashboard/project/riizybdrtikrcnrztcme/auth/url-configuration

Or navigate manually:
1. Go to https://supabase.com/dashboard/project/riizybdrtikrcnrztcme
2. Click **Authentication** in the left sidebar
3. Click **URL Configuration**

---

### Step 2: Update Site URL

Find the **"Site URL"** field and change it to:
```
https://elite-j55i24glt-adiljibranes-projects.vercel.app
```

**Remove** any localhost URLs like:
- ~~http://localhost:3000~~
- ~~http://localhost:8000~~

---

### Step 3: Update Redirect URLs

Find the **"Redirect URLs"** section and add these (one per line):

```
https://elite-j55i24glt-adiljibranes-projects.vercel.app/**
https://elite-j55i24glt-adiljibranes-projects.vercel.app/properties
https://elite-j55i24glt-adiljibranes-projects.vercel.app/login
http://localhost:3000/**
http://localhost:8000/**
```

The `**` means "any path" - it's a wildcard.

---

### Step 4: Save Changes

Click the **"Save"** button at the bottom.

---

### Step 5: Try Logging In Again

1. Go to: https://elite-j55i24glt-adiljibranes-projects.vercel.app/login
2. Enter your email: `adil.goolab@panache.mu`
3. Click "Send magic link" or "Send OTP"
4. Check your email
5. Click the magic link

**This time it should redirect to your Vercel site!**

---

## Alternative: Manual Session Setup (If still not working)

If the magic link still doesn't work after updating the URLs, you can manually log in:

### Option A: Use the Token from URL

1. When you click the magic link, even though it goes to localhost, copy the FULL URL
2. It will look like: `http://localhost:3000/#access_token=eyJ...&refresh_token=...`
3. Go to your Vercel site: https://elite-j55i24glt-adiljibranes-projects.vercel.app/
4. Open browser console (F12 → Console)
5. Paste this code:

```javascript
// Extract tokens from the localhost URL you copied
const urlParams = new URLSearchParams(window.location.hash.substring(1));
const accessToken = 'PASTE_ACCESS_TOKEN_HERE';  // From the localhost URL
const refreshToken = 'PASTE_REFRESH_TOKEN_HERE'; // From the localhost URL

// Set the session
const { data, error } = await supabase.auth.setSession({
  access_token: accessToken,
  refresh_token: refreshToken
});

if (error) {
  console.error('Error:', error);
} else {
  console.log('✅ Logged in!', data);
  window.location.href = '/properties';
}
```

### Option B: Request a New Magic Link (After fixing URLs)

Once you've updated the Supabase settings:

1. Go to: https://elite-j55i24glt-adiljibranes-projects.vercel.app/login
2. Request a **new** magic link
3. Check your email for the **new** link
4. Click it - should now work!

---

## 🎯 After You're Logged In

Once you successfully log in, you need to grant yourself admin access:

### Make Yourself Admin

1. Go to: https://supabase.com/dashboard/project/riizybdrtikrcnrztcme/sql/new
2. Run this SQL:

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
WHERE email = 'adil.goolab@panache.mu';

-- Verify it worked
SELECT
    id,
    email,
    raw_app_meta_data->>'is_admin' as is_admin,
    created_at
FROM auth.users
WHERE email = 'adil.goolab@panache.mu';
```

3. Refresh your browser
4. You should now see **"Admin"** in the navigation menu

---

## 🐛 Still Having Issues?

### Check Email Provider Settings

Go to: https://supabase.com/dashboard/project/riizybdrtikrcnrztcme/auth/providers

**Make sure Email provider is enabled:**
- ✅ Enable Email provider: ON
- ✅ Confirm email: OFF (for testing)
- Email OTP length: 6
- Magic Link: Enabled

---

## 📧 Change to OTP Instead of Magic Link

If you prefer OTP codes instead of magic links:

1. Go to: https://supabase.com/dashboard/project/riizybdrtikrcnrztcme/auth/providers
2. Find **Email** provider
3. Scroll down to **"Email OTP"**
4. Enable: ✅ **Enable Email OTP**
5. Disable: ❌ **Enable Magic Link** (uncheck this)
6. Save

Now when you sign in, you'll get a 6-digit code instead of a link.

---

## Summary

1. ✅ Update Site URL to your Vercel domain
2. ✅ Add Vercel domain to Redirect URLs
3. ✅ Save changes
4. ✅ Request new magic link
5. ✅ Grant yourself admin access via SQL
6. ✅ Start testing!

---

**Next:** See `E2E_TESTING_GUIDE.md` for complete testing instructions.

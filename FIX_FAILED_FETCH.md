# 🔧 Fix "Failed to fetch" Error

## The Problem
Supabase email provider might not be properly configured or enabled.

---

## ✅ Solution: Enable Email Authentication

### Step 1: Check Email Provider (1 minute)

1. Go to: https://supabase.com/dashboard/project/riizybdrtikrcnrztcme/auth/providers

2. Find **"Email"** in the list

3. Make sure these are configured:
   - ✅ **Enable Email provider**: ON
   - ✅ **Confirm email**: OFF (for testing)
   - ✅ **Secure email change**: OFF (for testing)

4. Scroll down to **Email Templates**
   - Make sure "Magic Link" template exists
   - Make sure "Confirm Signup" is disabled (for testing)

5. Click **Save**

---

### Step 2: Check Auth Settings

1. Go to: https://supabase.com/dashboard/project/riizybdrtikrcnrztcme/settings/auth

2. Verify these settings:
   - **Enable email confirmations**: OFF (for testing)
   - **Enable email signups**: ON
   - **Minimum password length**: 6 (default)

3. Scroll to **Email Auth**:
   - **Enable email/password sign ups**: ON
   - **Enable email OTP**: ON

4. Click **Save**

---

### Step 3: Verify Site URL

1. Go to: https://supabase.com/dashboard/project/riizybdrtikrcnrztcme/auth/url-configuration

2. Confirm:
   ```
   Site URL: https://elite-j55i24glt-adiljibranes-projects.vercel.app
   ```

3. In **Redirect URLs**, add:
   ```
   https://elite-j55i24glt-adiljibranes-projects.vercel.app/**
   ```

4. Click **Save**

---

### Step 4: Test Again

1. **Open a NEW incognito window**
2. Go to: https://elite-j55i24glt-adiljibranes-projects.vercel.app/login
3. Enter email: `adil.goolab@panache.mu`
4. Click "Send Magic Link"
5. **Should work now!**

---

## Alternative: Use Password Authentication Instead

If magic links still don't work, we can temporarily use password auth:

### Enable Password Auth
1. Go to: https://supabase.com/dashboard/project/riizybdrtikrcnrztcme/auth/providers
2. Make sure **"Email"** provider has password authentication enabled
3. Save

Then I can update the login page to use password instead of magic links.

---

## Common Issues

### "Failed to fetch" = One of these:
- Email provider disabled
- Email confirmations required (should be OFF)
- SMTP not configured (Supabase provides default)
- Site URL mismatch
- CORS blocking (shouldn't happen with correct Site URL)

### "Invalid login credentials" =
- User doesn't exist yet (need to sign up first)
- Wrong password (if using password auth)

### Magic link goes to localhost =
- Site URL not updated
- Old magic link from before URL change

---

**Action:** Check the Email provider settings in Step 1 above. That's most likely the issue.

# 🔧 Fix Vercel Deployment - Wrong Branch

## The Problem
Vercel is deploying from an old/wrong branch, so your Supabase credentials aren't being deployed.

---

## ✅ Solution: Update Vercel Production Branch (2 minutes)

### Step 1: Go to Vercel Settings

**Direct link:** https://vercel.com/adiljibranes-projects/elite-j55i24glt/settings/git

Or navigate:
1. Go to https://vercel.com/adiljibranes-projects/elite-j55i24glt
2. Click **Settings** (top nav)
3. Click **Git** (left sidebar)

---

### Step 2: Change Production Branch

Find the section **"Production Branch"**

**Current value** (probably): `main` or `master`

**Change it to:**
```
claude/elitemc-mvp-fullstack-011CV3pkuXE4WUhJRk7Ni86g
```

Click **Save**

---

### Step 3: Trigger Redeploy

After saving:
1. Go to **Deployments** tab
2. Find the most recent deployment
3. Click the **three dots menu (⋯)**
4. Click **"Redeploy"**
5. Make sure **"Use existing Build Cache"** is **UNCHECKED**
6. Click **"Redeploy"**

---

### Step 4: Wait & Verify (2 minutes)

1. Wait for deployment to finish (watch the progress)
2. Once it shows **"Ready"**, verify the fix:
   ```
   Open in NEW incognito window:
   https://elite-j55i24glt-adiljibranes-projects.vercel.app/js/supabaseClient.js
   ```
3. You should see:
   ```javascript
   const SUPABASE_URL = 'https://riizybdrtikrcnrztcme.supabase.co'
   const SUPABASE_ANON_KEY = 'eyJhbGci...'
   ```
   (NOT `your-project.supabase.co`)

---

### Step 5: Test Login

Once verified:
1. **Open NEW incognito window**
2. Go to: https://elite-j55i24glt-adiljibranes-projects.vercel.app/login
3. Enter email: `adil.goolab@panache.mu`
4. Click "Send Magic Link"
5. Check email → Click the link
6. **You should be logged in!** ✅

You'll see:
- Your email in top navigation
- "Properties", "Wallet", "Orders" links
- "Admin" link (after you run the SQL)
- "Logout" button

---

## Alternative: Merge to Main Branch (If you prefer)

If you'd rather use `main` as production branch:

1. Go to GitHub: https://github.com/adiljibrane/EliteMC
2. Create a Pull Request from `claude/elitemc-mvp-fullstack-011CV3pkuXE4WUhJRk7Ni86g` → `main`
3. Merge it
4. Vercel will auto-deploy from `main`

---

## Why This Happened

All the code with correct Supabase credentials is on the feature branch:
- `claude/elitemc-mvp-fullstack-011CV3pkuXE4WUhJRk7Ni86g` ✅ (has correct code)

But Vercel was deploying from:
- `main` ❌ (doesn't exist or has old code)

---

**Action**: Update Vercel Production Branch to `claude/elitemc-mvp-fullstack-011CV3pkuXE4WUhJRk7Ni86g` (Step 2 above)

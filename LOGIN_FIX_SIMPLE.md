# 🔧 Simple Login Fix - 3 Steps

## Step 1: Update Supabase Redirect URL (30 seconds)

**Go to:** https://supabase.com/dashboard/project/riizybdrtikrcnrztcme/auth/url-configuration

**Find "Site URL" and change it to:**
```
https://elite-j55i24glt-adiljibranes-projects.vercel.app
```

**Click Save.**

---

## Step 2: Grant Admin Access (30 seconds)

**Go to:** https://supabase.com/dashboard/project/riizybdrtikrcnrztcme/sql/new

**Paste this and click RUN:**
```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
WHERE email = 'adil.goolab@panache.mu';
```

---

## Step 3: Login (1 minute)

1. Go to: https://elite-j55i24glt-adiljibranes-projects.vercel.app/login
2. Enter your email: `adil.goolab@panache.mu`
3. Click "Send Magic Link"
4. Check your email
5. Click the magic link
6. **✅ You should be logged in with Admin access**

---

That's it! The code is already fixed and deployed.

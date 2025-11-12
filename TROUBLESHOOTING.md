# 🔧 Fix: Vercel Infinite Redirect Loop (ERR_TOO_MANY_REDIRECTS)

## Quick Diagnosis (1 minute)

```bash
# Test from terminal
curl -I https://your-site.vercel.app

# Look for redirect chain:
# HTTP/1.1 301 Moved Permanently
# Location: /index.html
# (repeated multiple times = loop detected)
```

---

## Root Cause

The issue is in `vercel.json` - the redirect rule is conflicting with how Vercel serves static files.

**Current problematic config:**
```json
{
  "redirects": [
    {
      "source": "/",
      "destination": "/index.html"  // ❌ This creates a loop!
    }
  ]
}
```

When someone visits `/`, Vercel:
1. Redirects to `/index.html`
2. `/index.html` is processed as `/`
3. Redirects again to `/index.html`
4. Loop! 💥

---

## Fix 1: Simple Vercel Config (RECOMMENDED)

Replace your `vercel.json` with this simplified version:

```json
{
  "version": 2,
  "public": true,
  "buildCommand": "echo 'Static site, no build needed'",
  "outputDirectory": "frontend",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    },
    {
      "source": "/js/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

**Key changes:**
- ❌ Removed `redirects` section entirely
- ✅ Kept `cleanUrls: true` - this auto-serves `index.html` for `/`
- ✅ Kept security headers
- ✅ Kept cache control

---

## Fix 2: Alternative - Rewrites Instead of Redirects

If you need more control:

```json
{
  "version": 2,
  "public": true,
  "outputDirectory": "frontend",
  "cleanUrls": true,
  "rewrites": [
    {
      "source": "/",
      "destination": "/index.html"
    },
    {
      "source": "/admin",
      "destination": "/admin/dashboard.html"
    }
  ],
  "headers": [
    // ... same as Fix 1
  ]
}
```

**Difference:**
- `redirects` = 301/302 HTTP redirect (causes loop)
- `rewrites` = internal routing (no loop)

---

## Fix 3: Check Auth Redirect Loop

If the loop persists, check `frontend/js/auth.js`:

```javascript
// ❌ BAD - Can cause loops
export const requireAuth = async (redirectTo = '/login.html') => {
  const session = await getSession()
  if (!session) {
    window.location.href = redirectTo  // If login also redirects, loop!
    return null
  }
  return session
}

// ✅ GOOD - Add loop prevention
export const requireAuth = async (redirectTo = '/login.html') => {
  // Don't redirect if already on login page
  if (window.location.pathname.includes('/login.html')) {
    return null
  }

  const session = await getSession()
  if (!session) {
    window.location.href = redirectTo
    return null
  }
  return session
}
```

---

## Step-by-Step Fix Process

### Step 1: Update vercel.json

```bash
# In your project root
# Replace vercel.json with Fix 1 content above
```

### Step 2: Test Locally

```bash
# Install Vercel CLI if you haven't
npm install -g vercel

# Test locally
cd /path/to/EliteMC
vercel dev

# Open: http://localhost:3000
# Should NOT redirect loop
```

### Step 3: Deploy Fix

```bash
# Commit the fix
git add vercel.json
git commit -m "fix: Remove redirect loop in vercel.json"
git push

# Force redeploy to Vercel
cd frontend
vercel --prod --force
```

### Step 4: Verify Fix

```bash
# Test the deployed site
curl -I https://your-site.vercel.app

# Should see:
# HTTP/2 200 OK
# (NOT 301 or 302)
```

Open browser:
```
https://your-site.vercel.app
```

Should load without loop! ✅

---

## Additional Checks

### Check 1: Supabase Redirect URLs

In Supabase Dashboard → Authentication → URL Configuration:

**Make sure these DON'T conflict:**
```
Site URL: https://your-site.vercel.app
Redirect URLs:
  https://your-site.vercel.app/**
  https://your-site.vercel.app/properties.html
  http://localhost:8000/**
```

**NOT:**
```
❌ https://your-site.vercel.app/index.html (can cause double redirects)
```

### Check 2: HTML Meta Redirects

Check your HTML files DON'T have:

```html
<!-- ❌ BAD - Remove if found -->
<meta http-equiv="refresh" content="0; url=/index.html">
```

Search all HTML files:
```bash
grep -r "http-equiv.*refresh" frontend/
# Should return nothing
```

### Check 3: JavaScript Redirects

Search for redirect loops in JS:

```bash
grep -r "window.location.href" frontend/js/
# Check each result - make sure no circular redirects
```

---

## Emergency Fix: Minimal Config

If nothing works, use absolute minimal config:

```json
{
  "version": 2,
  "buildCommand": "echo 'No build'",
  "outputDirectory": "frontend"
}
```

Then redeploy:
```bash
vercel --prod --force
```

---

## Debugging Tools

### 1. Check Redirect Chain

```bash
# See full redirect chain
curl -L -v https://your-site.vercel.app 2>&1 | grep -E '^< (HTTP|Location)'
```

### 2. Vercel Logs

```bash
# View deployment logs
vercel logs your-site.vercel.app --follow
```

### 3. Browser DevTools

1. Open DevTools (F12)
2. Network tab
3. Visit your site
4. Look for 301/302 status codes
5. Check Location headers

---

## Common Causes & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Loop on `/` | `redirects` in vercel.json | Use `rewrites` or remove |
| Loop on `/admin` | Auth redirects to login, login redirects back | Add loop prevention in auth.js |
| Loop after login | Supabase redirect URL wrong | Fix redirect URLs in Supabase |
| Loop on all pages | Trailing slash mismatch | Set `trailingSlash: false` |
| Loop with custom domain | DNS/SSL issues | Wait 24h for propagation |

---

## Quick Test After Fix

```bash
# 1. Homepage loads
curl -I https://your-site.vercel.app
# Should see: HTTP/2 200

# 2. Direct HTML loads
curl -I https://your-site.vercel.app/index.html
# Should see: HTTP/2 200

# 3. Login page loads
curl -I https://your-site.vercel.app/login.html
# Should see: HTTP/2 200

# 4. Admin loads (might 401 if not logged in, but NOT redirect)
curl -I https://your-site.vercel.app/admin/dashboard.html
# Should see: HTTP/2 200
```

---

## Still Stuck?

If loop persists after fixes:

1. **Delete and redeploy:**
   ```bash
   # In Vercel dashboard, delete the deployment
   # Then redeploy fresh
   vercel --prod --force
   ```

2. **Check Vercel support logs:**
   - Go to Vercel Dashboard
   - Select your project
   - Click "Deployments"
   - Click latest deployment
   - Check "Functions" and "Build" logs

3. **Temporarily disable auth:**
   ```javascript
   // Comment out auth guards in HTML files
   // <script type="module">
   //   import { requireAuth } from '/js/auth.js'
   //   await requireAuth()  // ← Comment this out temporarily
   // </script>
   ```

---

## Expected Behavior After Fix

✅ `https://your-site.vercel.app` → Shows homepage (200 OK)
✅ `https://your-site.vercel.app/` → Shows homepage (200 OK)
✅ `https://your-site.vercel.app/index.html` → Shows homepage (200 OK)
✅ `https://your-site.vercel.app/login.html` → Shows login (200 OK)
✅ `https://your-site.vercel.app/admin/dashboard.html` → Shows admin (200 OK if logged in)

---

**TL;DR:**
1. Replace `vercel.json` with Fix 1 (remove redirects)
2. Commit and push
3. Run `vercel --prod --force`
4. Test with `curl -I https://your-site.vercel.app`

Should be fixed in < 5 minutes! 🚀

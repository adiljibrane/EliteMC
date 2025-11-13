# 🧪 End-to-End Testing Guide for EliteMC

Your live site: **https://elite-j55i24glt-adiljibranes-projects.vercel.app/**

---

## 🎯 Phase 1: Basic Setup & User Registration (10 minutes)

### Step 1: Visit Homepage
1. Open: https://elite-j55i24glt-adiljibranes-projects.vercel.app/
2. **Check:**
   - [ ] Page loads without errors
   - [ ] Navigation menu appears
   - [ ] "Browse Properties" and "Get Started" links work

### Step 2: Sign Up as a User
1. Click **"Get Started"** or go to `/login`
2. Enter your email (use a real email you can access)
3. Click "Send OTP"
4. **Check your email** for the 6-digit code
5. Enter the OTP code
6. **Result:** You should be redirected to `/properties`

### Step 3: Explore as Regular User
- [ ] Visit `/properties` - Should show empty state or properties (if any exist)
- [ ] Visit `/wallet` - Should show MUR 0.00 balance
- [ ] Visit `/orders` - Should show no orders yet
- [ ] **Admin links should NOT appear** (you're not admin yet)

---

## 🔐 Phase 2: Grant Admin Access (2 minutes)

### Step 4: Make Yourself Admin

1. Note the **email address** you used to sign up
2. Go to Supabase SQL Editor: https://supabase.com/dashboard/project/riizybdrtikrcnrztcme/sql/new
3. Run this SQL (replace with YOUR email):

```sql
-- Check your user exists
SELECT id, email, raw_app_meta_data
FROM auth.users
WHERE email = 'your@email.com';

-- Grant admin access
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
WHERE email = 'your@email.com';

-- Verify it worked
SELECT id, email, raw_app_meta_data
FROM auth.users
WHERE email = 'your@email.com';
```

4. **Refresh your browser** (or logout/login again)
5. **Check:** Navigation should now show **"Admin"** link

---

## 👑 Phase 3: Test Admin Features (15 minutes)

### Step 5: Create a Property Listing

1. Go to `/admin/properties`
2. Click "Add New Property"
3. Fill in the form:
   ```
   Title: Sunset Villa - Port Louis
   Location: Port Louis, Mauritius
   Total Lots: 100
   Price per Lot: 50000
   Description: Luxury beachfront property with ocean views
   ```
4. Upload a property image (any image file)
5. Click "Create Property"
6. **Check:** Property appears in the list with status "OPEN"

### Step 6: Make a Deposit (Bank Transfer Simulation)

1. Go to `/admin/deposits` (or `/wallet` as user)
2. Click "Upload Bank Deposit Proof"
3. Fill in:
   ```
   Amount: 100000.00
   Bank Reference: TEST-DEPOSIT-001
   ```
4. Upload a fake receipt image (any image)
5. Click "Submit Deposit"
6. **Check:** Deposit appears with status "PENDING"

### Step 7: Match the Deposit (Admin Approval)

1. Stay in `/admin/deposits`
2. Find your pending deposit
3. Click "Match Deposit" or "Approve"
4. **Check:**
   - Deposit status changes to "MATCHED"
   - Go to `/wallet` - Balance should show **MUR 100,000.00**

---

## 💰 Phase 4: Property Purchase Flow (10 minutes)

### Step 8: Purchase Property Lots

1. Go to `/properties`
2. Click on "Sunset Villa - Port Louis"
3. In the purchase form:
   ```
   Number of Lots: 2
   Total Price: MUR 100,000.00 (2 × 50,000)
   ```
4. Click "Purchase Lots"
5. **Check:**
   - Success message appears
   - Order is created
   - Balance deducted from wallet

### Step 9: Verify Order

1. Go to `/orders`
2. **Check:**
   - [ ] Order appears with status "PAID"
   - [ ] Shows 2 lots for Sunset Villa
   - [ ] Total price: MUR 100,000.00

### Step 10: Check Allocations

1. Go to Supabase SQL Editor
2. Run:
```sql
SELECT * FROM property_allocations
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
```
3. **Check:**
   - [ ] Allocation exists for 2 lots
   - [ ] Status: "PENDING_OFFCHAIN"
   - [ ] Property ID matches Sunset Villa

---

## 💸 Phase 5: Dividend Distribution (10 minutes)

### Step 11: Settle the Allocation (Admin)

1. Go to Supabase SQL Editor
2. Run:
```sql
-- Get the allocation ID
SELECT id, property_id, lots, user_id, status
FROM property_allocations
WHERE status = 'PENDING_OFFCHAIN';

-- Settle it (replace the ID)
UPDATE property_allocations
SET status = 'SETTLED_OFFCHAIN',
    settled_at = NOW()
WHERE id = 'YOUR-ALLOCATION-ID-HERE';
```

### Step 12: Calculate Dividends

1. Go to `/admin/dividends`
2. Select "Sunset Villa - Port Louis"
3. Enter:
   ```
   Total Dividend Amount: 5000.00
   Apply to Internal Balances: Yes (checked)
   ```
4. Click "Calculate & Distribute"
5. **Check:**
   - Success message: "Dividend distributed to X shareholders"
   - Dividend statement created

### Step 13: Verify Dividend Payment

1. Go to `/wallet`
2. **Check:**
   - [ ] New balance = Previous balance + dividend
   - [ ] Transaction history shows dividend credit

2. Check in SQL:
```sql
-- View dividend statement
SELECT * FROM dividend_statements
WHERE property_id = (SELECT id FROM properties WHERE title LIKE '%Sunset Villa%');

-- View your payout
SELECT * FROM dividend_payouts
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your@email.com');

-- Check ledger
SELECT * FROM fiat_ledger
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your@email.com')
ORDER BY created_at DESC;
```

---

## 🔍 Phase 6: Audit & Verification (5 minutes)

### Step 14: Check Audit Logs

```sql
-- View all audit logs for your user
SELECT
    action,
    entity_type,
    entity_id,
    details,
    created_at
FROM audit_log
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your@email.com')
ORDER BY created_at DESC;
```

**Should show:**
- Property creation
- Deposit submission
- Deposit matching
- Order creation
- Dividend calculation
- Dividend payout

---

## ✅ Complete Testing Checklist

### Frontend
- [ ] Homepage loads
- [ ] Login/OTP works
- [ ] Navigation works (no 404s)
- [ ] Properties page loads
- [ ] Property detail page works
- [ ] Wallet page shows balance
- [ ] Orders page shows history
- [ ] Admin dashboard accessible (for admin)
- [ ] Admin deposits page works
- [ ] Admin properties page works
- [ ] Admin dividends page works

### Backend (Edge Functions)
- [ ] `capture_order` - Payment capture works
- [ ] `match_deposit` - Deposit matching works
- [ ] `calculate_dividends` - Dividend calculation works

### Database
- [ ] User profile created
- [ ] Fiat balance tracks correctly
- [ ] Property allocations created
- [ ] Dividend statements generated
- [ ] Audit logs recorded

### Security
- [ ] Non-admin cannot access admin pages
- [ ] RLS policies prevent unauthorized access
- [ ] Authentication required for protected routes

---

## 🐛 Common Issues & Fixes

### Issue: OTP Email Not Received
**Fix:** Check spam folder, or check Supabase Auth settings for email configuration

### Issue: 404 on Navigation
**Fix:** Already fixed! All paths are root-relative now

### Issue: "Insufficient balance" on purchase
**Fix:** Make sure deposit was matched (check `/wallet` balance)

### Issue: Admin menu not appearing
**Fix:**
1. Verify SQL update worked
2. Logout and login again
3. Check browser console for errors

### Issue: Edge Function 401/403 errors
**Fix:** Make sure you're logged in and have a valid session

---

## 📊 Expected Final State

After completing all tests:

**Your User:**
- Email: your@email.com
- Admin: Yes
- KYC Status: PENDING (can be updated manually)
- Wallet Balance: ~MUR 5,000+ (from dividends)

**Database Records:**
- 1 Property (Sunset Villa)
- 1 Bank Deposit (MATCHED)
- 1 Order (PAID)
- 1 Property Allocation (SETTLED_OFFCHAIN)
- 1 Dividend Statement
- 1 Dividend Payout
- Multiple Audit Log entries

**Fiat Ledger:**
- CREDIT: +100,000 (deposit matched)
- DEBIT: -100,000 (property purchase)
- CREDIT: +5,000 (dividend received)

---

## 🎉 Success!

If all tests pass, your MVP is **fully functional** and ready for:
- User acceptance testing
- Adding more properties
- Onboarding real users
- Phase 2: Blockchain integration

---

**Need help?** Check:
- `TROUBLESHOOTING.md` - Common fixes
- `DEPLOYMENT.md` - Deployment guide
- `README.md` - Full documentation

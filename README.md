# EliteMC Cooperative - Property Investment Platform

**Production-Ready MVP for Fractional Real Estate Ownership in Mauritius**

EliteMC Cooperative is a blockchain-ready property investment platform that enables fractional ownership of real estate in Mauritius. Built with vanilla HTML/JS and Supabase, with future integration for Polkadot Asset Hub.

---

## 🚀 Features

### Phase 1: Off-Chain (Current MVP)

- ✅ **Email OTP Authentication** - Passwordless login via Supabase Auth
- ✅ **User Profiles** - KYC status, wallet addresses (blockchain-ready)
- ✅ **Fiat Wallet System** - Internal MUR balance management
- ✅ **Bank Deposit Matching** - Admin approval workflow
- ✅ **Property Listings** - Create and manage investment properties
- ✅ **Fractional Lot Purchases** - Buy property lots using internal balance
- ✅ **Off-Chain Cap Table** - Track all ownership allocations
- ✅ **Dividend Distribution** - Pro-rata dividend calculations and payouts
- ✅ **Audit Logging** - Complete trail of admin actions
- ✅ **Blockchain-Ready Structure** - Database fields for Asset Hub integration

### Phase 2: On-Chain (Future)

- 🔜 Polkadot Asset Hub token minting
- 🔜 On-chain ownership transfer
- 🔜 Wallet integration (@polkadot/extension-dapp)
- 🔜 Indexer for transaction confirmation

---

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Supabase Account** (free tier works)
- **Supabase CLI** - Install: `npm install -g supabase`
- **Local HTTP Server** - VS Code Live Server or `npx serve`

---

## ⚡ Quick Start (10 Minutes)

### 1. Clone & Setup

```bash
cd EliteMC
cp .env.example .env
```

### 2. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Copy your project URL and keys

### 3. Configure Environment

Edit `.env`:
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Also update `frontend/js/supabaseClient.js` with your credentials:
```javascript
const SUPABASE_URL = 'https://your-project-ref.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key'
```

### 4. Run Database Schema

In Supabase Dashboard → SQL Editor, run:
```sql
-- Copy and paste contents of sql/schema.sql
```

### 5. Create Storage Buckets

In Supabase Dashboard → Storage:

1. Create bucket: `bank-proofs` (public)
2. Create bucket: `properties` (public) - for property images

Set both buckets to **public** with these policies:
```sql
-- Allow public read
CREATE POLICY "Public Read" ON storage.objects FOR SELECT USING (true);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
```

#### Storage Setup for Property Images

The platform stores property images in the `properties` bucket. When adding properties via the admin panel, images are uploaded and stored with their file paths in the `properties.images` column as a JSONB array.

**Bucket Configuration:**
- **Bucket name:** `properties`
- **Public access:** Yes (recommended for demo/MVP)
- **Access policy:** Public read, authenticated upload

**How images are stored:**
1. Images are uploaded to Supabase Storage `properties` bucket
2. File paths (e.g., `property-123/image-1.jpg`) are stored in `properties.images` as JSONB array
3. Frontend uses `publicImageUrl()` helper to convert storage paths to public URLs
4. If image fails to load, falls back to `/assets/placeholders/property.svg`

**Using Signed URLs (for private buckets):**
If you prefer to keep the bucket private, use signed URLs instead:
```javascript
import { signedImageUrl } from '/js/supabaseClient.js'

// Generate signed URL with 1-hour expiry
const imageUrl = await signedImageUrl(imagePath, 3600)
```

**Image format:**
- Recommended: JPG, PNG, WebP
- Max size: 5MB per image
- Aspect ratio: 16:9 or 4:3
- Resolution: 1200x800px minimum

### 6. Deploy Edge Functions

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy capture_order
supabase functions deploy match_deposit
supabase functions deploy calculate_dividends

# Set secrets
supabase secrets set SUPABASE_URL=https://your-project-ref.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 7. Create Admin User

1. Open `frontend/login.html` in browser
2. Sign up with email (e.g., `admin@elitemc.mu`)
3. Check email for magic link and verify
4. In Supabase Dashboard → SQL Editor, make the user admin:

```sql
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{is_admin}',
    'true'::jsonb
)
WHERE email = 'admin@elitemc.mu';
```

### 8. Load Seed Data (Optional)

**Important:** First create users via the UI, then update `sql/seed.sql` with their actual UUIDs before running.

```sql
-- In Supabase SQL Editor, run sql/seed.sql after updating user IDs
```

### 9. Start Frontend

```bash
# Option 1: VS Code Live Server (recommended)
# Right-click frontend/index.html → "Open with Live Server"

# Option 2: npx serve
npx serve frontend -p 8000

# Option 3: Python
python3 -m http.server 8000 --directory frontend
```

### 10. Access the Application

- **Homepage:** http://localhost:8000/index.html
- **Admin Dashboard:** http://localhost:8000/admin/dashboard.html

---

## 📂 Project Structure

```
EliteMC/
├── sql/
│   ├── schema.sql          # Complete database schema with RLS
│   └── seed.sql            # Demo data for testing
├── supabase/
│   ├── functions/
│   │   ├── capture_order/index.ts       # Pay for orders
│   │   ├── match_deposit/index.ts       # Match bank deposits
│   │   └── calculate_dividends/index.ts # Distribute dividends
│   └── types.ts            # TypeScript type definitions
├── frontend/
│   ├── index.html          # Homepage
│   ├── login.html          # Auth (sign in/up)
│   ├── properties.html     # Property listings
│   ├── property.html       # Property detail & buy
│   ├── wallet.html         # User wallet & deposits
│   ├── orders.html         # User orders
│   ├── admin/
│   │   ├── dashboard.html  # Admin overview
│   │   ├── deposits.html   # Match deposits
│   │   ├── properties.html # Manage properties
│   │   ├── dividends.html  # Distribute dividends
│   │   └── mint-prep.html  # Blockchain prep
│   └── js/
│       ├── supabaseClient.js   # Supabase config
│       ├── ui.js               # UI utilities
│       ├── auth.js             # Authentication
│       ├── properties.js       # Property operations
│       ├── property-detail.js  # Buy flow
│       ├── wallet.js           # Wallet operations
│       ├── orders.js           # Order management
│       ├── admin.js            # Admin utilities
│       ├── deposits-admin.js   # Deposit matching
│       ├── dividends-admin.js  # Dividend distribution
│       └── mint-prep.js        # Blockchain prep
├── .env.example
├── .gitignore
└── README.md
```

---

## 🎯 User Flows

### For Investors

1. **Sign Up** → Email OTP verification
2. **Deposit Funds** → Bank transfer + upload proof
3. **Admin Matches Deposit** → Balance credited
4. **Browse Properties** → Filter and view details
5. **Buy Lots** → Purchase using internal balance
6. **Receive Dividends** → Auto-credited to wallet

### For Admins

1. **Create Property** → Set price, lots, description
2. **Publish Property** → Change status to OPEN
3. **Match Deposits** → Review and approve submissions
4. **Close Property** → When fully subscribed
5. **Distribute Dividends** → Calculate pro-rata payouts
6. **Prepare for Minting** → Export CSV, check wallet readiness

---

## 🔐 Security Features

### Row Level Security (RLS)

All tables have RLS enabled with policies:
- Users can only access their own data
- Admins have full access (via JWT claim `is_admin`)
- Money operations require service role

### Edge Functions

- **Atomic transactions** - All money operations are transactional
- **Idempotency keys** - Prevent duplicate charges
- **Service role only** - Balance updates only via Edge Functions
- **Validation** - Zod schema validation on all inputs

### Audit Trail

- All admin actions logged to `audit_log` table
- Track who did what, when, and why

---

## 💰 Money Flow

### Deposit Flow

```
User submits deposit → Admin reviews → Edge Function credits balance → User can buy lots
```

### Purchase Flow

```
User creates order → Edge Function locks balance → Debit balance → Create allocation
```

### Dividend Flow

```
Admin creates statement → Calculate pro-rata → Credit wallets (or bank transfer)
```

### Invariants

- `available + locked = total deposits - total purchases + total dividends`
- Every balance change has a ledger entry
- Orders can only be paid once (idempotent)

---

## 🧪 Testing the MVP

### 1. Create Test Users

Sign up 3 users via the UI:
- admin@elitemc.mu (make admin)
- alice@example.com
- bob@example.com

### 2. Test Deposit Flow

As Alice:
1. Go to Wallet page
2. Submit deposit (MUR 100,000)
3. Upload proof of payment

As Admin:
1. Go to Admin → Deposits
2. Match Alice's deposit
3. Verify Alice's balance increased

### 3. Test Property Flow

As Admin:
1. Go to Admin → Properties
2. Create new property
   - Title: "Test Apartment"
   - Price per lot: MUR 10,000
   - Total lots: 10
   - Status: OPEN

### 4. Test Purchase Flow

As Alice:
1. Browse properties
2. View "Test Apartment"
3. Buy 5 lots (MUR 50,000)
4. Check Orders page
5. Check Wallet (balance should decrease)

### 5. Test Dividend Flow

As Admin:
1. Go to Admin → Dividends
2. Select "Test Apartment"
3. Enter income (MUR 10,000) and expenses (MUR 1,000)
4. Preview distribution
5. Confirm & distribute
6. Verify Alice received dividend in wallet

---

## 🔗 Blockchain Integration (Phase 2)

### Architecture

```
EliteMC Platform → Polkadot.js API → Asset Hub Testnet/Mainnet
```

### Steps to Integrate

1. **Install Dependencies**
```bash
npm install @polkadot/api @polkadot/extension-dapp
```

2. **Create Asset on Asset Hub**
```javascript
const api = await ApiPromise.create({ provider: wsProvider })
const assetId = await api.tx.assets.create(...)
```

3. **Mint Tokens**
```javascript
await api.tx.assets.mint(assetId, totalSupply)
```

4. **Batch Transfer**
```javascript
const transfers = allocations.map(a =>
  api.tx.assets.transfer(assetId, a.wallet, a.lots)
)
await api.tx.utility.batch(transfers)
```

5. **Record On-Chain Data**
```sql
UPDATE properties SET asset_hub_asset_id = ? WHERE id = ?
UPDATE property_allocations SET
  onchain_tx_hash = ?,
  onchain_block = ?,
  status = 'ONCHAIN_SETTLED'
WHERE property_id = ?
```

6. **Set Up Indexer**
- Use SubQuery or similar to monitor transactions
- Confirm transfers and update database

---

## 🛠️ Admin How-Tos

### How to Publish a New Property

1. Go to Admin → Properties
2. Fill in property details
3. Upload images (future enhancement)
4. Set status to **OPEN**
5. Property appears on public listings

### How to Match a Deposit

1. Go to Admin → Deposits
2. Filter by **PENDING**
3. Click **View Slip** to verify
4. Click **Match** to credit user
5. User balance updates instantly

### How to Close a Property Raise

1. Go to Admin → Properties
2. Find the property
3. Change status to **CLOSED**
4. No more purchases allowed

### How to Distribute Dividends

1. Go to Admin → Dividends
2. Select property
3. Enter period dates
4. Enter gross income and expenses
5. Click **Preview Distribution**
6. Review allocations
7. Click **Confirm & Distribute**
8. Users receive payouts (internal credit or manual bank transfer)

### How to Prepare for Blockchain Minting

1. Go to Admin → Mint Prep
2. Select property with status **READY_TO_MINT**
3. Check wallet readiness
4. Export CSV of allocations
5. Connect admin wallet (future)
6. Create Asset Hub asset
7. Mint and distribute tokens
8. Update property status to **MINTED**

---

## 🐛 Troubleshooting

### Edge Functions Not Working

```bash
# Check function logs
supabase functions logs capture_order

# Redeploy
supabase functions deploy capture_order --no-verify-jwt
```

### RLS Blocking Queries

```sql
-- Temporarily disable RLS for debugging (NEVER in production)
ALTER TABLE properties DISABLE ROW LEVEL SECURITY;

-- Re-enable
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
```

### Admin Access Not Working

```sql
-- Verify admin flag
SELECT email, raw_app_meta_data->'is_admin' as is_admin FROM auth.users;

-- Set admin flag
UPDATE auth.users SET raw_app_meta_data =
  jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{is_admin}', 'true'::jsonb)
WHERE email = 'your-admin-email@example.com';
```

### Balance Not Updating

- Check Edge Function logs
- Verify service role key is correct
- Check `fiat_ledger` for entries
- Ensure RLS policies allow service role

---

## 🚀 Deployment to Production

### Frontend

Deploy to:
- **Vercel** (recommended)
- **Netlify**
- **Cloudflare Pages**

Update `supabaseClient.js` with production URLs.

### Backend

Supabase handles hosting automatically. Just ensure:
- Edge Functions are deployed
- Storage buckets are configured
- RLS policies are correct

### Security Checklist

- [ ] Remove seed data
- [ ] Rotate all keys
- [ ] Enable CAPTCHA on signup
- [ ] Set up monitoring (Sentry, etc.)
- [ ] Configure email templates
- [ ] Enable MFA for admin users
- [ ] Set up backup strategy
- [ ] Configure rate limiting

---

## 📊 Database Diagram

```
auth.users (Supabase Auth)
    ↓
profiles (user data, KYC, wallet)
    ↓
├─ fiat_balances (internal MUR balance)
├─ fiat_ledger (audit trail of balance changes)
├─ bank_deposits (deposit submissions)
├─ orders (purchase intents)
├─ property_allocations (cap table)
└─ dividend_payouts (earnings)

properties (real estate listings)
    ↓
├─ property_allocations (ownership)
├─ dividend_statements (income periods)
└─ token_mint_batches (blockchain records)
```

---

## 📝 License

Copyright © 2025 EliteMC Cooperative. All rights reserved.

---

## 🤝 Support

For issues or questions:
- Check troubleshooting section
- Review Supabase logs
- Check browser console for errors

---

## 🎉 Congratulations!

You now have a production-ready MVP for fractional property investment. Next steps:

1. Customize branding and colors
2. Add more property details (images, documents)
3. Integrate payment gateway for deposits
4. Build mobile app (React Native + same Supabase backend)
5. Integrate Polkadot Asset Hub for on-chain tokens
6. Add SMS notifications
7. Implement KYC verification flow

**Happy Building! 🏗️**

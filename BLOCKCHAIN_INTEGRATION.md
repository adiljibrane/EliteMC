# 🔗 Property Token Minting & Blockchain Integration Guide

## Overview

EliteMC is designed to tokenize real estate properties on **Polkadot Asset Hub** (formerly Statemint). This guide covers how to mint property tokens and connect them to the blockchain.

---

## 📊 Current Status: Phase 1 (Off-Chain)

**What's Working Now:**
- ✅ Properties tracked in database
- ✅ Off-chain allocations (cap table)
- ✅ Internal MUR balance system
- ✅ Dividend distribution
- ✅ Admin management

**What's Prepared (Not Yet Active):**
- Database fields for blockchain data:
  - `asset_hub_asset_id` - Token ID on Asset Hub
  - `decimals` - Token decimals (usually 0 for real estate)
  - `onchain_tx_hash` - Transaction hashes
  - `onchain_settled` status flags
- Edge Functions structure ready for blockchain calls
- Frontend ready to display on-chain status

---

## 🎯 Phase 2: Blockchain Integration Architecture

### High-Level Flow

```
1. Admin creates property (off-chain) ✅
2. Users purchase lots (off-chain) ✅
3. Property reaches target (ready to mint)
4. Admin mints token on Asset Hub → Gets asset_id
5. Admin settles allocations (mints tokens to users)
6. Tokens are now on-chain ✅
7. Users can transfer tokens on Asset Hub
8. Dividends still paid to internal wallets (Phase 3: on-chain dividends)
```

---

## 🔧 Phase 2 Implementation Steps

### Step 1: Set Up Polkadot Asset Hub Connection

**Option A: Use Polkadot.js API (JavaScript)**

Install dependencies:
```bash
npm install @polkadot/api @polkadot/keyring @polkadot/util-crypto
```

**Create new Edge Function:** `supabase/functions/mint_property_token/index.ts`

```typescript
import { ApiPromise, WsProvider } from '@polkadot/api'
import { Keyring } from '@polkadot/keyring'
import { cryptoWaitReady } from '@polkadot/util-crypto'

// Asset Hub endpoint
const ASSET_HUB_ENDPOINT = 'wss://polkadot-asset-hub-rpc.polkadot.io'

// Admin wallet (KEEP PRIVATE!)
const ADMIN_SEED = Deno.env.get('POLKADOT_ADMIN_SEED') // Store in Supabase secrets

async function mintPropertyToken(propertyId: string, totalSupply: number) {
  await cryptoWaitReady()

  // Connect to Asset Hub
  const provider = new WsProvider(ASSET_HUB_ENDPOINT)
  const api = await ApiPromise.create({ provider })

  // Load admin account
  const keyring = new Keyring({ type: 'sr25519' })
  const admin = keyring.addFromUri(ADMIN_SEED)

  // Create asset
  const assetId = Math.floor(Math.random() * 1000000) // Or use sequential ID
  const minBalance = 1 // Minimum balance (usually 1 for NFT-like assets)

  const tx = api.tx.assets.create(
    assetId,
    admin.address, // Admin as owner
    minBalance
  )

  // Sign and send
  const hash = await tx.signAndSend(admin)

  return {
    assetId,
    txHash: hash.toHex(),
    success: true
  }
}
```

---

**Option B: Use Substrate Connect (Lighter Weight)**

For browser-based transactions:
```javascript
import { ScProvider } from '@polkadot/rpc-provider/substrate-connect'
import { ApiPromise } from '@polkadot/api'

const provider = new ScProvider('polkadot-asset-hub')
const api = await ApiPromise.create({ provider })
```

---

### Step 2: Create Property Token on Asset Hub

**What You Need:**
- Polkadot account with DOT for fees (~0.01 DOT per transaction)
- Asset Hub endpoint: `wss://polkadot-asset-hub-rpc.polkadot.io`

**Create Asset Transaction:**
```javascript
// Parameters
const assetId = 1000 // Unique asset ID (choose unused number)
const admin = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' // Your admin address
const minBalance = 1 // Minimum balance

// Create asset
const createAssetTx = api.tx.assets.create(
  assetId,
  admin,
  minBalance
)

await createAssetTx.signAndSend(adminKeyPair, ({ status, events }) => {
  if (status.isInBlock) {
    console.log(`✅ Asset created in block ${status.asInBlock}`)
  }
})
```

---

### Step 3: Set Asset Metadata

Give your token a name and symbol:

```javascript
// Set metadata
const name = 'Sunset Villa Lots'
const symbol = 'SVILLA'
const decimals = 0 // No decimals for real estate lots

const setMetadataTx = api.tx.assets.setMetadata(
  assetId,
  name,
  symbol,
  decimals
)

await setMetadataTx.signAndSend(adminKeyPair)
```

---

### Step 4: Mint Tokens to Users

After settling allocations off-chain, mint on-chain:

```javascript
// Mint tokens
const userAddress = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'
const amount = 10 // 10 lots

const mintTx = api.tx.assets.mint(
  assetId,
  userAddress,
  amount
)

await mintTx.signAndSend(adminKeyPair, ({ status }) => {
  if (status.isInBlock) {
    console.log(`✅ Minted ${amount} tokens to ${userAddress}`)
  }
})
```

---

### Step 5: Update Database with On-Chain Data

After minting on-chain, update the database:

```sql
-- Update property with asset ID
UPDATE properties
SET
  asset_hub_asset_id = '1000',
  decimals = 0,
  status = 'MINTED'
WHERE id = 'property-uuid';

-- Update allocation with on-chain status
UPDATE property_allocations
SET
  status = 'ONCHAIN_SETTLED',
  onchain_tx_hash = '0x1234abcd...',
  settled_at = NOW()
WHERE id = 'allocation-uuid';
```

---

## 🖥️ Frontend Integration

### Admin Mint Button

Add to `/admin/mint-prep.html`:

```javascript
async function mintProperty(propertyId) {
  // Call Edge Function
  const { data, error } = await supabase.functions.invoke('mint_property_token', {
    body: { property_id: propertyId }
  })

  if (error) {
    showError('Mint failed: ' + error.message)
    return
  }

  showSuccess(`✅ Token minted! Asset ID: ${data.assetId}`)
  showSuccess(`Transaction: ${data.txHash}`)

  // Refresh property list
  await loadProperties()
}
```

---

### Display On-Chain Status

Update property cards to show blockchain status:

```javascript
${property.asset_hub_asset_id ? `
  <div class="bg-purple-100 border border-purple-300 rounded p-2 mt-2">
    <p class="text-xs text-purple-800">
      🔗 On-Chain: Asset #${property.asset_hub_asset_id}
      <a href="https://assethub-polkadot.subscan.io/asset/${property.asset_hub_asset_id}"
         target="_blank" class="underline">View on Subscan</a>
    </p>
  </div>
` : ''}
```

---

## 🔐 Security Considerations

### 1. Admin Key Management

**CRITICAL: Never expose admin private key in frontend!**

✅ **Correct Approach:**
- Store admin seed/private key in Supabase secrets
- Use Edge Functions to sign transactions server-side
- Frontend only triggers Edge Functions (no keys exposed)

❌ **Wrong Approach:**
- Never put private keys in frontend code
- Never commit keys to Git
- Never expose keys in API responses

---

### 2. Set Admin Key in Supabase

```bash
# In your terminal (with Supabase CLI)
supabase secrets set POLKADOT_ADMIN_SEED="your seed phrase here"

# Or via Supabase dashboard:
# Project Settings → Edge Functions → Secrets
```

---

### 3. Multi-Sig for Production

For production, use multi-signature accounts:
- Require 2-of-3 or 3-of-5 signatures
- Reduces risk of single key compromise
- Use Polkadot.js Apps to create multisig

---

## 📝 Complete Implementation Checklist

### Backend Setup
- [ ] Install Polkadot.js dependencies
- [ ] Create `mint_property_token` Edge Function
- [ ] Create `settle_allocation_onchain` Edge Function
- [ ] Store admin seed in Supabase secrets
- [ ] Test connection to Asset Hub testnet

### Asset Hub Setup
- [ ] Get Polkadot account (Polkadot.js extension)
- [ ] Fund account with ~0.1 DOT
- [ ] Choose unique asset IDs (1000+)
- [ ] Test on Westend Asset Hub first

### Database Updates
- [ ] Run any pending schema migrations
- [ ] Verify `asset_hub_asset_id` column exists
- [ ] Verify `onchain_tx_hash` columns exist

### Frontend Updates
- [ ] Add "Mint Token" button to admin property management
- [ ] Add on-chain status indicators
- [ ] Add Subscan.io links for transactions
- [ ] Show asset ID on property detail pages

### Testing
- [ ] Test on Westend Asset Hub (testnet)
- [ ] Verify token creation
- [ ] Verify token minting to users
- [ ] Verify metadata display
- [ ] Test with small amounts first!

---

## 🧪 Testing on Westend (Testnet)

Before mainnet, test on Westend Asset Hub:

```javascript
// Use Westend endpoint for testing
const WESTEND_ASSET_HUB = 'wss://westend-asset-hub-rpc.polkadot.io'

// Get free test tokens:
// 1. Visit https://faucet.polkadot.io/westend
// 2. Enter your address
// 3. Receive test WND tokens
```

---

## 💰 Cost Estimates

**Polkadot Asset Hub Fees:**
- Create asset: ~0.01 DOT ($0.05-$0.10)
- Set metadata: ~0.005 DOT ($0.02-$0.05)
- Mint tokens: ~0.005 DOT per user
- Transfer tokens: User pays (~0.005 DOT)

**For 100 properties with 1000 users:**
- Total cost: ~5-10 DOT ($25-$100)
- Very affordable compared to Ethereum!

---

## 🎓 Learning Resources

**Polkadot Asset Hub:**
- Docs: https://wiki.polkadot.network/docs/learn-assets
- Explorer: https://assethub-polkadot.subscan.io/
- API Docs: https://polkadot.js.org/docs/substrate/extrinsics

**Polkadot.js:**
- Get Started: https://polkadot.js.org/docs/api/start
- Examples: https://polkadot.js.org/docs/api/examples
- Keyring: https://polkadot.js.org/docs/keyring

**Tutorials:**
- Create Asset: https://wiki.polkadot.network/docs/learn-assets#creating-an-asset
- Mint Tokens: https://wiki.polkadot.network/docs/learn-assets#minting-an-asset

---

## 🚀 Quick Start for Blockchain Integration

### Immediate Next Steps:

1. **Install Polkadot.js Extension**
   - Chrome: https://chrome.google.com/webstore/detail/polkadot%7Bjs%7D-extension/mopnmbcafieddcagagdcbnhejhlodfdd

2. **Create Admin Wallet**
   - Open extension → Create new account
   - Save seed phrase securely!
   - Switch network to "Asset Hub"

3. **Get DOT Tokens**
   - Buy on exchange (minimum 0.1 DOT)
   - Send to your Asset Hub address

4. **Test on Westend First**
   - Use testnet before mainnet
   - Free test tokens from faucet

5. **I'll help you implement the Edge Functions**
   - Let me know when you're ready
   - We'll create the minting functions together

---

## 📞 Ready to Implement?

Let me know when you want to:
1. Set up the Polkadot connection
2. Create the mint Edge Functions
3. Test on Westend testnet
4. Deploy to mainnet

I can guide you through each step! 🚀

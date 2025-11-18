# 🚀 Complete Property Token Minting Implementation Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Phase 1: Environment Setup](#phase-1-environment-setup)
3. [Phase 2: Install Dependencies](#phase-2-install-dependencies)
4. [Phase 3: Create Mint Edge Function](#phase-3-create-mint-edge-function)
5. [Phase 4: Create Settle Allocation Function](#phase-4-create-settle-allocation-function)
6. [Phase 5: Update Frontend](#phase-5-update-frontend)
7. [Phase 6: Testing on Westend](#phase-6-testing-on-westend)
8. [Phase 7: Mainnet Deployment](#phase-7-mainnet-deployment)

---

## Prerequisites

### What You Need:
- ✅ Supabase project (you have this)
- ✅ Supabase CLI installed
- ✅ Node.js installed
- ⬜ Polkadot wallet account
- ⬜ DOT tokens for fees (~0.1 DOT minimum)
- ⬜ Polkadot.js browser extension

### Install Missing Tools:

```bash
# 1. Install Supabase CLI (if not installed)
npm install -g supabase

# 2. Install Node.js (if not installed)
# Download from https://nodejs.org/

# 3. Install Polkadot.js Extension
# Chrome: https://chrome.google.com/webstore/detail/polkadot%7Bjs%7D-extension/mopnmbcafieddcagagdcbnhejhlodfdd
```

---

## Phase 1: Environment Setup

### Step 1.1: Create Polkadot Wallet

1. Install Polkadot.js Extension (link above)
2. Open extension → **"Create new account"**
3. **Save your 12-word seed phrase securely!** (Write it down offline)
4. Set a strong password
5. Name the account (e.g., "EliteMC Admin")
6. Copy your address (starts with `1...`)

### Step 1.2: Get Test Tokens (Westend)

Before using real DOT, test on Westend:

1. Visit https://faucet.polkadot.io/westend
2. Paste your Polkadot address
3. Request test WND tokens
4. Wait ~30 seconds for tokens to arrive

### Step 1.3: Set Up Supabase Secrets

Store your admin seed phrase securely:

```bash
# Navigate to your project
cd /home/user/EliteMC

# Set Polkadot admin seed (USE YOUR ACTUAL SEED!)
supabase secrets set POLKADOT_ADMIN_SEED="your twelve word seed phrase goes here like this example"

# Set network endpoint (start with Westend testnet)
supabase secrets set ASSET_HUB_ENDPOINT="wss://westend-asset-hub-rpc.polkadot.io"
```

⚠️ **CRITICAL SECURITY:** Never commit seed phrases to Git!

---

## Phase 2: Install Dependencies

### Step 2.1: Create Package Configuration

Create `/home/user/EliteMC/supabase/functions/package.json`:

```json
{
  "name": "elitemc-edge-functions",
  "version": "1.0.0",
  "description": "EliteMC Blockchain Integration",
  "dependencies": {
    "@polkadot/api": "^10.11.2",
    "@polkadot/keyring": "^12.6.2",
    "@polkadot/util-crypto": "^12.6.2",
    "@polkadot/util": "^12.6.2"
  }
}
```

### Step 2.2: Install Packages

```bash
cd supabase/functions
npm install

# This will create node_modules with Polkadot packages
```

---

## Phase 3: Create Mint Edge Function

### Step 3.1: Create Mint Function File

Create `/home/user/EliteMC/supabase/functions/mint_property_token/index.ts`:

```typescript
// =====================================================
// Mint Property Token on Polkadot Asset Hub
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { ApiPromise, WsProvider } from 'npm:@polkadot/api@^10.11.2'
import { Keyring } from 'npm:@polkadot/keyring@^12.6.2'
import { cryptoWaitReady } from 'npm:@polkadot/util-crypto@^12.6.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user || !user.app_metadata?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { property_id } = await req.json()

    if (!property_id) {
      return new Response(
        JSON.stringify({ error: 'property_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch property from database
    const { data: property, error: propError } = await supabaseClient
      .from('properties')
      .select('*')
      .eq('id', property_id)
      .single()

    if (propError || !property) {
      return new Response(
        JSON.stringify({ error: 'Property not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if already minted
    if (property.asset_hub_asset_id) {
      return new Response(
        JSON.stringify({
          error: 'Property already minted',
          asset_id: property.asset_hub_asset_id
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize crypto
    await cryptoWaitReady()

    // Connect to Asset Hub
    const endpoint = Deno.env.get('ASSET_HUB_ENDPOINT') ?? 'wss://westend-asset-hub-rpc.polkadot.io'
    const provider = new WsProvider(endpoint)
    const api = await ApiPromise.create({ provider })

    // Load admin account from seed
    const adminSeed = Deno.env.get('POLKADOT_ADMIN_SEED')
    if (!adminSeed) {
      throw new Error('POLKADOT_ADMIN_SEED not configured')
    }

    const keyring = new Keyring({ type: 'sr25519' })
    const admin = keyring.addFromUri(adminSeed)

    console.log('Admin address:', admin.address)

    // Generate unique asset ID (you can use sequential IDs or random)
    const assetId = 1000 + Math.floor(Math.random() * 9000) // Random ID between 1000-9999
    const minBalance = 1 // Minimum balance per user

    // Create asset on-chain
    console.log('Creating asset with ID:', assetId)

    const createTx = api.tx.assets.create(
      assetId,
      admin.address, // Admin as owner
      minBalance
    )

    // Sign and send transaction
    const createHash = await new Promise((resolve, reject) => {
      createTx.signAndSend(admin, ({ status, dispatchError }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule)
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs}`))
          } else {
            reject(new Error(dispatchError.toString()))
          }
        }

        if (status.isInBlock || status.isFinalized) {
          resolve(status.asInBlock?.toHex() || status.asFinalized?.toHex())
        }
      })
    })

    console.log('Asset created in block:', createHash)

    // Set metadata (name, symbol, decimals)
    const name = property.title.substring(0, 32) // Max 32 chars
    const symbol = property.title.substring(0, 8).toUpperCase().replace(/[^A-Z]/g, '') || 'PROP'
    const decimals = 0 // No decimals for real estate lots

    const metadataTx = api.tx.assets.setMetadata(
      assetId,
      name,
      symbol,
      decimals
    )

    const metadataHash = await new Promise((resolve, reject) => {
      metadataTx.signAndSend(admin, ({ status, dispatchError }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule)
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs}`))
          } else {
            reject(new Error(dispatchError.toString()))
          }
        }

        if (status.isInBlock || status.isFinalized) {
          resolve(status.asInBlock?.toHex() || status.asFinalized?.toHex())
        }
      })
    })

    console.log('Metadata set in block:', metadataHash)

    // Update property in database
    const { error: updateError } = await supabaseClient
      .from('properties')
      .update({
        asset_hub_asset_id: assetId.toString(),
        decimals: decimals,
        status: 'MINTED'
      })
      .eq('id', property_id)

    if (updateError) {
      throw new Error(`Failed to update property: ${updateError.message}`)
    }

    // Create audit log
    await supabaseClient
      .from('audit_log')
      .insert({
        actor_user_id: user.id,
        action: 'mint_property_token',
        target_table: 'properties',
        target_id: property_id,
        details: {
          asset_id: assetId,
          create_tx_hash: createHash,
          metadata_tx_hash: metadataHash,
          name, symbol, decimals
        }
      })

    // Disconnect
    await api.disconnect()

    return new Response(
      JSON.stringify({
        success: true,
        asset_id: assetId,
        name, symbol, decimals,
        create_tx_hash: createHash,
        metadata_tx_hash: metadataHash,
        explorer_url: `https://westend.subscan.io/asset/${assetId}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in mint_property_token:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### Step 3.2: Deploy Mint Function

```bash
cd /home/user/EliteMC

# Deploy the function
supabase functions deploy mint_property_token

# Verify deployment
supabase functions list
```

---

## Phase 4: Create Settle Allocation Function

Create `/home/user/EliteMC/supabase/functions/settle_allocation_onchain/index.ts`:

```typescript
// =====================================================
// Settle Allocation On-Chain (Mint tokens to user)
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { ApiPromise, WsProvider } from 'npm:@polkadot/api@^10.11.2'
import { Keyring } from 'npm:@polkadot/keyring@^12.6.2'
import { cryptoWaitReady } from 'npm:@polkadot/util-crypto@^12.6.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user || !user.app_metadata?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request
    const { allocation_id } = await req.json()

    if (!allocation_id) {
      return new Response(
        JSON.stringify({ error: 'allocation_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch allocation with property and profile
    const { data: allocation, error: allocError } = await supabaseClient
      .from('property_allocations')
      .select(`
        *,
        properties:property_id (asset_hub_asset_id, title),
        profiles:user_id (wallet_ss58)
      `)
      .eq('id', allocation_id)
      .single()

    if (allocError || !allocation) {
      return new Response(
        JSON.stringify({ error: 'Allocation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validation
    if (!allocation.properties?.asset_hub_asset_id) {
      return new Response(
        JSON.stringify({ error: 'Property not minted yet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!allocation.profiles?.wallet_ss58) {
      return new Response(
        JSON.stringify({ error: 'User wallet address not set' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (allocation.status === 'ONCHAIN_SETTLED') {
      return new Response(
        JSON.stringify({ error: 'Allocation already settled on-chain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize crypto
    await cryptoWaitReady()

    // Connect to Asset Hub
    const endpoint = Deno.env.get('ASSET_HUB_ENDPOINT') ?? 'wss://westend-asset-hub-rpc.polkadot.io'
    const provider = new WsProvider(endpoint)
    const api = await ApiPromise.create({ provider })

    // Load admin account
    const adminSeed = Deno.env.get('POLKADOT_ADMIN_SEED')
    if (!adminSeed) {
      throw new Error('POLKADOT_ADMIN_SEED not configured')
    }

    const keyring = new Keyring({ type: 'sr25519' })
    const admin = keyring.addFromUri(adminSeed)

    // Mint tokens to user
    const assetId = parseInt(allocation.properties.asset_hub_asset_id)
    const userAddress = allocation.profiles.wallet_ss58
    const amount = allocation.lots

    console.log(`Minting ${amount} tokens of asset ${assetId} to ${userAddress}`)

    const mintTx = api.tx.assets.mint(
      assetId,
      userAddress,
      amount
    )

    const mintHash = await new Promise((resolve, reject) => {
      mintTx.signAndSend(admin, ({ status, dispatchError }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule)
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs}`))
          } else {
            reject(new Error(dispatchError.toString()))
          }
        }

        if (status.isInBlock || status.isFinalized) {
          resolve(status.asInBlock?.toHex() || status.asFinalized?.toHex())
        }
      })
    })

    console.log('Tokens minted in block:', mintHash)

    // Update allocation status
    const { error: updateError } = await supabaseClient
      .from('property_allocations')
      .update({
        status: 'ONCHAIN_SETTLED',
        onchain_tx_hash: mintHash,
        settled_at: new Date().toISOString()
      })
      .eq('id', allocation_id)

    if (updateError) {
      throw new Error(`Failed to update allocation: ${updateError.message}`)
    }

    // Create audit log
    await supabaseClient
      .from('audit_log')
      .insert({
        actor_user_id: user.id,
        action: 'settle_allocation_onchain',
        target_table: 'property_allocations',
        target_id: allocation_id,
        details: {
          asset_id: assetId,
          user_address: userAddress,
          amount,
          tx_hash: mintHash
        }
      })

    await api.disconnect()

    return new Response(
      JSON.stringify({
        success: true,
        tx_hash: mintHash,
        asset_id: assetId,
        amount,
        user_address: userAddress,
        explorer_url: `https://westend.subscan.io/extrinsic/${mintHash}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in settle_allocation_onchain:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

Deploy:

```bash
supabase functions deploy settle_allocation_onchain
```

---

## Phase 5: Update Frontend

Update `/home/user/EliteMC/frontend/admin/mint-prep.html` to add actual mint buttons.

I'll create the updated files in the next message for you to review!

---

## Phase 6: Testing on Westend

### Test Checklist:

1. ✅ Verify admin wallet has test WND tokens
2. ✅ Create a test property with status 'READY_TO_MINT'
3. ✅ Click "Mint Token" button
4. ✅ Verify asset created on Westend Asset Hub
5. ✅ Check Subscan explorer link
6. ✅ Settle test allocation (mint to user)
7. ✅ Verify user receives tokens

### Explorer Links:
- **Westend Asset Hub**: https://westend.subscan.io/
- **Check your asset**: https://westend.subscan.io/asset/{asset_id}

---

## Phase 7: Mainnet Deployment

### Before Mainnet:

1. **Get Real DOT**:
   - Buy from exchange (Kraken, Binance, etc.)
   - Minimum 0.5 DOT recommended
   - Send to your Polkadot address

2. **Update Secrets** (switch from Westend to Polkadot):
   ```bash
   supabase secrets set ASSET_HUB_ENDPOINT="wss://polkadot-asset-hub-rpc.polkadot.io"
   ```

3. **Redeploy Functions**:
   ```bash
   supabase functions deploy mint_property_token
   supabase functions deploy settle_allocation_onchain
   ```

4. **Test with Small Property First!**

---

## Next Steps

Would you like me to:
1. ✅ Create the updated frontend files with mint buttons?
2. ✅ Create helper scripts for batch minting?
3. ✅ Set up monitoring/notifications for minting events?

Let me know and I'll implement it step-by-step!

// =====================================================
// Mint Preparation Module - Blockchain-Ready
// =====================================================

import { supabase, requireUser } from './supabaseClient.js'
import { showSuccess, showError, showWarning } from './ui.js'
import { fetchPropertyAllocations } from './properties.js'

// ========== Export Allocations as CSV ==========

export const exportAllocationsCSV = async (propertyId) => {
  try {
    const allocations = await fetchPropertyAllocations(propertyId)

    if (!allocations || allocations.length === 0) {
      showError('No allocations found for this property')
      return
    }

    // Filter only eligible allocations
    const eligible = allocations.filter(a =>
      a.status === 'SETTLED_OFFCHAIN' || a.status === 'ONCHAIN_SETTLED'
    )

    if (eligible.length === 0) {
      showError('No eligible allocations (must be SETTLED_OFFCHAIN or ONCHAIN_SETTLED)')
      return
    }

    // Generate CSV
    const headers = ['user_id', 'full_name', 'email', 'wallet_ss58', 'lots', 'status']
    const rows = eligible.map(a => [
      a.user_id,
      a.profiles?.full_name || '',
      a.profiles?.email || '',
      a.profiles?.wallet_ss58 || 'NOT_SET',
      a.lots,
      a.status,
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `allocations-${propertyId}-${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    showSuccess(`Exported ${eligible.length} allocations to CSV`)
  } catch (error) {
    showError(error.message || 'Failed to export CSV')
  }
}

// ========== Check Wallet Readiness ==========

export const checkWalletReadiness = async (propertyId) => {
  try {
    const allocations = await fetchPropertyAllocations(propertyId)

    const eligible = allocations.filter(a =>
      a.status === 'SETTLED_OFFCHAIN' || a.status === 'ONCHAIN_SETTLED'
    )

    const withoutWallet = eligible.filter(a => !a.profiles?.wallet_ss58)

    return {
      total: eligible.length,
      withWallet: eligible.length - withoutWallet.length,
      withoutWallet: withoutWallet.length,
      users: withoutWallet.map(a => ({
        user_id: a.user_id,
        full_name: a.profiles?.full_name,
        email: a.profiles?.email,
        lots: a.lots,
      })),
    }
  } catch (error) {
    console.error('Error checking wallet readiness:', error)
    return {
      total: 0,
      withWallet: 0,
      withoutWallet: 0,
      users: [],
    }
  }
}

// ========== Render Wallet Readiness Report ==========

export const renderWalletReadinessReport = (report, container) => {
  const percentage = report.total > 0
    ? ((report.withWallet / report.total) * 100).toFixed(1)
    : 0

  container.innerHTML = `
    <div class="bg-white rounded-2xl shadow-md p-6 mb-6">
      <h3 class="text-xl font-bold text-gray-800 mb-4">Wallet Readiness</h3>

      <div class="grid grid-cols-3 gap-4 mb-4">
        <div class="text-center">
          <p class="text-sm text-gray-600">Total Shareholders</p>
          <p class="text-3xl font-bold text-gray-800">${report.total}</p>
        </div>
        <div class="text-center">
          <p class="text-sm text-gray-600">With Wallet</p>
          <p class="text-3xl font-bold text-green-600">${report.withWallet}</p>
        </div>
        <div class="text-center">
          <p class="text-sm text-gray-600">Without Wallet</p>
          <p class="text-3xl font-bold text-red-600">${report.withoutWallet}</p>
        </div>
      </div>

      <div class="mb-4">
        <div class="flex justify-between text-sm mb-1">
          <span class="text-gray-600">Readiness</span>
          <span class="font-semibold">${percentage}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div class="bg-green-600 h-3 rounded-full transition-all" style="width: ${percentage}%"></div>
        </div>
      </div>

      ${report.withoutWallet > 0 ? `
        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p class="text-sm text-yellow-800 font-semibold mb-2">⚠️ ${report.withoutWallet} user(s) without wallet address</p>
          <p class="text-xs text-yellow-700">These users need to connect their Polkadot wallet before on-chain minting.</p>
        </div>
      ` : `
        <div class="bg-green-50 border border-green-200 rounded-xl p-4">
          <p class="text-sm text-green-800 font-semibold">✅ All shareholders have wallet addresses</p>
          <p class="text-xs text-green-700">Ready for on-chain token minting!</p>
        </div>
      `}
    </div>

    ${report.withoutWallet > 0 ? `
      <div class="bg-white rounded-2xl shadow-md p-6">
        <h4 class="text-lg font-bold text-gray-800 mb-4">Users Without Wallet</h4>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b-2 border-gray-200">
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Lots</th>
              </tr>
            </thead>
            <tbody>
              ${report.users.map(user => `
                <tr class="border-b border-gray-100">
                  <td class="px-4 py-3 text-sm font-semibold text-gray-800">${user.full_name}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">${user.email}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">${user.lots}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `
}

// ========== Polkadot Wallet Connection (Placeholder) ==========

export const connectPolkadotWallet = async () => {
  try {
    showWarning('Polkadot wallet integration coming soon!')

    // Placeholder for future implementation
    // const { web3Accounts, web3Enable, web3FromAddress } = await import('@polkadot/extension-dapp')
    // await web3Enable('EliteMC Cooperative')
    // const accounts = await web3Accounts()

    return null
  } catch (error) {
    showError('Failed to connect wallet')
    return null
  }
}

// ========== Save Wallet Address ==========

export const saveWalletAddress = async (walletSS58) => {
  try {
    const user = await requireUser()

    const { data, error } = await supabase
      .from('profiles')
      .update({ wallet_ss58: walletSS58 })
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    showSuccess('Wallet address saved successfully')
    return data
  } catch (error) {
    showError(error.message || 'Failed to save wallet address')
    throw error
  }
}

// ========== Validate SS58 Address ==========

export const validateSS58Address = (address) => {
  // Basic validation for Polkadot SS58 addresses
  // Proper validation would use @polkadot/util-crypto
  if (!address || address.length < 47 || address.length > 48) {
    return false
  }

  // Polkadot addresses typically start with '1' (mainnet) or other prefixes
  return /^[1-9A-HJ-NP-Za-km-z]{47,48}$/.test(address)
}

// ========== Create Token Mint Batch Record ==========

export const createMintBatch = async (propertyId, assetId, totalMinted, signerWallet) => {
  try {
    const { data, error } = await supabase
      .from('token_mint_batches')
      .insert({
        property_id: propertyId,
        asset_id: assetId,
        total_minted: totalMinted,
        signer_wallet: signerWallet,
        status: 'PLANNED',
      })
      .select()
      .single()

    if (error) throw error

    showSuccess('Mint batch record created')
    return data
  } catch (error) {
    showError(error.message || 'Failed to create mint batch')
    throw error
  }
}

// =====================================================
// Wallet Module - Balance, Ledger, Deposits
// =====================================================

import { supabase } from './supabaseClient.js'
import { formatMUR, formatDateTime, showSuccess, showError, showSpinner, showEmptyState, getStatusBadge, disableButton, enableButton } from './ui.js'

// ========== Fetch User Balance ==========

export const fetchBalance = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('fiat_balances')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // No balance record, create one
      const { data: newBalance, error: createError } = await supabase
        .from('fiat_balances')
        .insert({ user_id: user.id, available: '0', locked: '0' })
        .select()
        .single()

      if (createError) throw createError
      return newBalance
    }

    if (error) throw error
    return data || { available: '0', locked: '0' }
  } catch (error) {
    console.error('Error fetching balance:', error)
    return { available: '0', locked: '0' }
  }
}

// ========== Fetch Ledger Entries ==========

export const fetchLedger = async (filters = {}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    let query = supabase
      .from('fiat_ledger')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (filters.direction) {
      query = query.eq('direction', filters.direction)
    }

    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching ledger:', error)
    return []
  }
}

// ========== Render Ledger Table ==========

export const renderLedgerTable = (entries, container) => {
  if (!entries || entries.length === 0) {
    showEmptyState(container, 'No transactions yet', '💳')
    return
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b-2 border-gray-200">
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reason</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(entry => `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
              <td class="px-4 py-3 text-sm text-gray-600">${formatDateTime(entry.created_at)}</td>
              <td class="px-4 py-3">
                ${entry.direction === 'CREDIT'
                  ? '<span class="px-2 py-1 rounded-full text-xs font-semibold bg-green-200 text-green-800">Credit</span>'
                  : '<span class="px-2 py-1 rounded-full text-xs font-semibold bg-red-200 text-red-800">Debit</span>'
                }
              </td>
              <td class="px-4 py-3 text-sm font-semibold ${entry.direction === 'CREDIT' ? 'text-green-600' : 'text-red-600'}">
                ${entry.direction === 'CREDIT' ? '+' : '-'}${formatMUR(entry.amount_mur)}
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">${entry.reason}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

// ========== Fetch User Deposits ==========

export const fetchDeposits = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('bank_deposits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching deposits:', error)
    return []
  }
}

// ========== Render Deposits Table ==========

export const renderDepositsTable = (deposits, container) => {
  if (!deposits || deposits.length === 0) {
    showEmptyState(container, 'No deposits submitted yet', '🏦')
    return
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b-2 border-gray-200">
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Bank Ref</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Proof</th>
          </tr>
        </thead>
        <tbody>
          ${deposits.map(deposit => `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
              <td class="px-4 py-3 text-sm text-gray-600">${formatDateTime(deposit.created_at)}</td>
              <td class="px-4 py-3 text-sm font-mono">${deposit.bank_ref}</td>
              <td class="px-4 py-3 text-sm font-semibold text-gray-800">${formatMUR(deposit.amount_mur)}</td>
              <td class="px-4 py-3">${getStatusBadge(deposit.status)}</td>
              <td class="px-4 py-3">
                ${deposit.proof_url
                  ? `<a href="${deposit.proof_url}" target="_blank" class="text-indigo-600 hover:underline">View</a>`
                  : '<span class="text-gray-400">N/A</span>'
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

// ========== Submit Deposit ==========

export const submitDeposit = async (bankRef, amount, receivedDate, proofFile, button) => {
  try {
    disableButton(button, 'Submitting...')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    let proofUrl = null

    // Upload proof if provided
    if (proofFile) {
      const fileExt = proofFile.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bank-proofs')
        .upload(fileName, proofFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('bank-proofs')
        .getPublicUrl(fileName)

      proofUrl = publicUrl
    }

    // Create deposit record
    const { data, error } = await supabase
      .from('bank_deposits')
      .insert({
        user_id: user.id,
        bank_ref: bankRef,
        amount_mur: amount.toString(),
        received_date: receivedDate,
        proof_url: proofUrl,
        status: 'PENDING',
      })
      .select()
      .single()

    if (error) throw error

    showSuccess('Deposit submitted successfully! Awaiting admin approval.')
    return data
  } catch (error) {
    showError(error.message || 'Failed to submit deposit')
    throw error
  } finally {
    enableButton(button)
  }
}

// ========== Fetch User Portfolio ==========

export const fetchPortfolio = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('user_portfolios')
      .select('*')
      .eq('user_id', user.id)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching portfolio:', error)
    return []
  }
}

// ========== Render Portfolio ==========

export const renderPortfolio = (portfolio, container) => {
  if (!portfolio || portfolio.length === 0) {
    showEmptyState(container, 'No investments yet', '📊')
    return
  }

  container.innerHTML = `
    <div class="grid gap-4">
      ${portfolio.map(item => `
        <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-lg font-bold text-gray-800">${item.property_title}</h3>
              <p class="text-sm text-gray-600">${item.property_location}</p>
            </div>
            ${getStatusBadge(item.allocation_status)}
          </div>

          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-gray-600">Lots Owned</p>
              <p class="text-xl font-bold text-indigo-600">${item.total_lots}</p>
            </div>
            <div>
              <p class="text-gray-600">Total Invested</p>
              <p class="text-xl font-bold text-gray-800">${formatMUR(item.total_invested)}</p>
            </div>
          </div>

          <button onclick="window.location.href='/property?id=${item.property_id}'"
                  class="mt-4 w-full px-4 py-2 rounded-xl border border-indigo-600 text-indigo-600 hover:bg-indigo-50 transition">
            View Property
          </button>
        </div>
      `).join('')}
    </div>
  `
}

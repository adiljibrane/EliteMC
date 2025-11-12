// =====================================================
// Admin Deposits Module
// =====================================================

import { supabase, invokeEdgeFunction } from './supabaseClient.js'
import { formatMUR, formatDateTime, showSuccess, showError, showEmptyState, getStatusBadge, disableButton, enableButton, confirmAction } from './ui.js'

// ========== Fetch All Deposits ==========

export const fetchAllDeposits = async (status = null) => {
  try {
    let query = supabase
      .from('bank_deposits')
      .select(`
        *,
        profiles:user_id (full_name, email, phone),
        matcher:matched_by (full_name, email)
      `)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching deposits:', error)
    return []
  }
}

// ========== Render Deposits Table ==========

export const renderDepositsTable = (deposits, container, options = {}) => {
  if (!deposits || deposits.length === 0) {
    showEmptyState(container, 'No deposits found', '🏦')
    return
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b-2 border-gray-200">
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">User</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Bank Ref</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Proof</th>
            ${options.showActions ? '<th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${deposits.map(deposit => `
            <tr class="border-b border-gray-100 hover:bg-gray-50" data-deposit-id="${deposit.id}">
              <td class="px-4 py-3 text-sm text-gray-600">${formatDateTime(deposit.created_at)}</td>
              <td class="px-4 py-3">
                <div class="text-sm font-semibold text-gray-800">${deposit.profiles?.full_name || 'Unknown'}</div>
                <div class="text-xs text-gray-500">${deposit.profiles?.email || ''}</div>
              </td>
              <td class="px-4 py-3 text-sm font-mono">${deposit.bank_ref}</td>
              <td class="px-4 py-3 text-sm font-semibold text-gray-800">${formatMUR(deposit.amount_mur)}</td>
              <td class="px-4 py-3">${getStatusBadge(deposit.status)}</td>
              <td class="px-4 py-3">
                ${deposit.proof_url
                  ? `<button onclick="window.open('${deposit.proof_url}', '_blank')" class="text-indigo-600 hover:underline text-sm">View Slip</button>`
                  : '<span class="text-gray-400 text-sm">N/A</span>'
                }
              </td>
              ${options.showActions && deposit.status === 'PENDING' ? `
                <td class="px-4 py-3">
                  <div class="flex gap-2">
                    <button onclick="window.matchDeposit('${deposit.id}')"
                            class="px-3 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm">
                      Match
                    </button>
                    <button onclick="window.rejectDeposit('${deposit.id}')"
                            class="px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm">
                      Reject
                    </button>
                  </div>
                </td>
              ` : options.showActions ? `
                <td class="px-4 py-3">
                  <span class="text-gray-400 text-sm">
                    ${deposit.status === 'MATCHED' ? `Matched by ${deposit.matcher?.full_name || 'Admin'}` : 'Rejected'}
                  </span>
                </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

// ========== Match Deposit ==========

export const matchDeposit = async (depositId, notes = null) => {
  try {
    const confirmed = await confirmAction(
      'This will credit the user\'s balance. Continue?',
      'Match Deposit'
    )

    if (!confirmed) return null

    const result = await invokeEdgeFunction('match_deposit', {
      bank_deposit_id: depositId,
      action: 'MATCH',
      notes,
    })

    showSuccess(`Deposit matched! ${formatMUR(result.amount_credited)} credited.`)
    return result
  } catch (error) {
    showError(error.message || 'Failed to match deposit')
    throw error
  }
}

// ========== Reject Deposit ==========

export const rejectDeposit = async (depositId, notes = null) => {
  try {
    const confirmed = await confirmAction(
      'Are you sure you want to reject this deposit?',
      'Reject Deposit'
    )

    if (!confirmed) return null

    const result = await invokeEdgeFunction('match_deposit', {
      bank_deposit_id: depositId,
      action: 'REJECT',
      notes,
    })

    showSuccess('Deposit rejected')
    return result
  } catch (error) {
    showError(error.message || 'Failed to reject deposit')
    throw error
  }
}

// ========== Get Deposit Details ==========

export const getDepositDetails = async (depositId) => {
  try {
    const { data, error } = await supabase
      .from('bank_deposits')
      .select(`
        *,
        profiles:user_id (full_name, email, phone, kyc_status)
      `)
      .eq('id', depositId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching deposit details:', error)
    throw error
  }
}

// ========== Render Deposit Details Modal ==========

export const renderDepositDetailsModal = (deposit, modalContainer) => {
  const user = deposit.profiles

  modalContainer.innerHTML = `
    <div class="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4">
      <div class="flex justify-between items-start mb-4">
        <h2 class="text-2xl font-bold text-gray-800">Deposit Details</h2>
        <button onclick="window.closeDepositModal()" class="text-gray-500 hover:text-gray-700">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="space-y-4">
        <!-- User Info -->
        <div class="bg-gray-50 rounded-xl p-4">
          <h3 class="font-semibold text-gray-700 mb-2">User Information</h3>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span class="text-gray-600">Name:</span>
              <span class="ml-2 font-semibold">${user?.full_name || 'N/A'}</span>
            </div>
            <div>
              <span class="text-gray-600">Email:</span>
              <span class="ml-2 font-semibold">${user?.email || 'N/A'}</span>
            </div>
            <div>
              <span class="text-gray-600">Phone:</span>
              <span class="ml-2 font-semibold">${user?.phone || 'N/A'}</span>
            </div>
            <div>
              <span class="text-gray-600">KYC:</span>
              ${getStatusBadge(user?.kyc_status || 'PENDING')}
            </div>
          </div>
        </div>

        <!-- Deposit Info -->
        <div class="bg-gray-50 rounded-xl p-4">
          <h3 class="font-semibold text-gray-700 mb-2">Deposit Information</h3>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span class="text-gray-600">Bank Reference:</span>
              <span class="ml-2 font-mono font-semibold">${deposit.bank_ref}</span>
            </div>
            <div>
              <span class="text-gray-600">Amount:</span>
              <span class="ml-2 font-semibold text-green-600">${formatMUR(deposit.amount_mur)}</span>
            </div>
            <div>
              <span class="text-gray-600">Received Date:</span>
              <span class="ml-2 font-semibold">${formatDateTime(deposit.received_date)}</span>
            </div>
            <div>
              <span class="text-gray-600">Status:</span>
              ${getStatusBadge(deposit.status)}
            </div>
          </div>
        </div>

        <!-- Proof of Payment -->
        ${deposit.proof_url ? `
          <div class="bg-gray-50 rounded-xl p-4">
            <h3 class="font-semibold text-gray-700 mb-2">Proof of Payment</h3>
            <img src="${deposit.proof_url}" alt="Proof" class="w-full rounded-lg border border-gray-200">
          </div>
        ` : ''}

        <!-- Actions -->
        ${deposit.status === 'PENDING' ? `
          <div class="flex gap-3 pt-4">
            <button onclick="window.confirmMatch('${deposit.id}')"
                    class="flex-1 px-4 py-3 rounded-xl bg-green-600 text-white hover:bg-green-700 font-semibold">
              Match & Credit User
            </button>
            <button onclick="window.confirmReject('${deposit.id}')"
                    class="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white hover:bg-red-700 font-semibold">
              Reject Deposit
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `
}

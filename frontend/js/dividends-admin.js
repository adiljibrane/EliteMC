// =====================================================
// Admin Dividends Module
// =====================================================

import { supabase, invokeEdgeFunction } from './supabaseClient.js'
import { formatMUR, formatDate, showSuccess, showError, disableButton, enableButton, confirmAction } from './ui.js'

// ========== Calculate & Distribute Dividends ==========

export const calculateDividends = async (dividendData, button) => {
  try {
    disableButton(button, 'Processing...')

    const confirmed = await confirmAction(
      `This will distribute ${formatMUR(dividendData.gross_income_mur - dividendData.expenses_mur)} to eligible shareholders. Continue?`,
      'Confirm Dividend Distribution'
    )

    if (!confirmed) {
      enableButton(button)
      return null
    }

    const result = await invokeEdgeFunction('calculate_dividends', dividendData)

    showSuccess(`Dividends distributed to ${result.payouts_count} shareholders!`)
    return result
  } catch (error) {
    showError(error.message || 'Failed to calculate dividends')
    throw error
  } finally {
    enableButton(button)
  }
}

// ========== Fetch Dividend Statements ==========

export const fetchDividendStatements = async (propertyId = null) => {
  try {
    let query = supabase
      .from('dividend_statements')
      .select(`
        *,
        properties:property_id (title, location),
        profiles:created_by (full_name, email)
      `)
      .order('created_at', { ascending: false })

    if (propertyId) {
      query = query.eq('property_id', propertyId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching dividend statements:', error)
    return []
  }
}

// ========== Fetch Dividend Payouts ==========

export const fetchDividendPayouts = async (statementId) => {
  try {
    const { data, error } = await supabase
      .from('dividend_payouts')
      .select(`
        *,
        profiles:user_id (full_name, email)
      `)
      .eq('statement_id', statementId)
      .order('amount_mur', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching dividend payouts:', error)
    return []
  }
}

// ========== Preview Dividend Distribution ==========

export const previewDividendDistribution = async (propertyId, distributableAmount) => {
  try {
    // Fetch eligible allocations
    const { data: allocations, error } = await supabase
      .from('property_allocations')
      .select(`
        user_id,
        lots,
        profiles:user_id (full_name, email)
      `)
      .eq('property_id', propertyId)
      .in('status', ['SETTLED_OFFCHAIN', 'ONCHAIN_SETTLED'])

    if (error) throw error

    if (!allocations || allocations.length === 0) {
      return []
    }

    // Aggregate lots per user
    const userLotsMap = new Map()
    let totalLots = 0

    for (const allocation of allocations) {
      const current = userLotsMap.get(allocation.user_id) || { lots: 0, profile: allocation.profiles }
      userLotsMap.set(allocation.user_id, {
        lots: current.lots + allocation.lots,
        profile: allocation.profiles,
      })
      totalLots += allocation.lots
    }

    // Calculate distribution
    const preview = []
    for (const [userId, data] of userLotsMap.entries()) {
      const percentage = data.lots / totalLots
      const amount = distributableAmount * percentage

      preview.push({
        user_id: userId,
        full_name: data.profile?.full_name || 'Unknown',
        email: data.profile?.email || '',
        lots: data.lots,
        percentage: (percentage * 100).toFixed(2),
        amount: Math.round(amount * 100) / 100,
      })
    }

    return preview.sort((a, b) => b.amount - a.amount)
  } catch (error) {
    console.error('Error previewing distribution:', error)
    return []
  }
}

// ========== Render Dividend Preview ==========

export const renderDividendPreview = (preview, container) => {
  if (!preview || preview.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No eligible shareholders found</p>'
    return
  }

  const totalAmount = preview.reduce((sum, p) => sum + p.amount, 0)

  container.innerHTML = `
    <div class="bg-gray-50 rounded-xl p-4 mb-4">
      <div class="grid grid-cols-3 gap-4 text-center">
        <div>
          <p class="text-sm text-gray-600">Total Shareholders</p>
          <p class="text-2xl font-bold text-gray-800">${preview.length}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Total Lots</p>
          <p class="text-2xl font-bold text-gray-800">${preview.reduce((sum, p) => sum + p.lots, 0)}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Total Distribution</p>
          <p class="text-2xl font-bold text-green-600">${formatMUR(totalAmount)}</p>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b-2 border-gray-200">
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Shareholder</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Lots</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ownership</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Payout</th>
          </tr>
        </thead>
        <tbody>
          ${preview.map(p => `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
              <td class="px-4 py-3">
                <div class="text-sm font-semibold text-gray-800">${p.full_name}</div>
                <div class="text-xs text-gray-500">${p.email}</div>
              </td>
              <td class="px-4 py-3 text-sm font-semibold text-gray-800">${p.lots}</td>
              <td class="px-4 py-3 text-sm text-gray-600">${p.percentage}%</td>
              <td class="px-4 py-3 text-sm font-bold text-green-600">${formatMUR(p.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

// ========== Render Dividend Statements Table ==========

export const renderDividendStatementsTable = (statements, container) => {
  if (!statements || statements.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">No dividend statements yet</p>'
    return
  }

  container.innerHTML = `
    <div class="space-y-4">
      ${statements.map(statement => `
        <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-lg font-bold text-gray-800">${statement.properties?.title || 'Unknown Property'}</h3>
              <p class="text-sm text-gray-600">${formatDate(statement.period_start)} - ${formatDate(statement.period_end)}</p>
            </div>
            <span class="text-xs text-gray-500">${formatDate(statement.created_at)}</span>
          </div>

          <div class="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p class="text-sm text-gray-600">Gross Income</p>
              <p class="text-lg font-semibold text-gray-800">${formatMUR(statement.gross_income_mur)}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600">Expenses</p>
              <p class="text-lg font-semibold text-red-600">${formatMUR(statement.expenses_mur)}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600">Distributed</p>
              <p class="text-lg font-semibold text-green-600">${formatMUR(statement.distributable_mur)}</p>
            </div>
          </div>

          <button onclick="window.viewDividendPayouts('${statement.id}')"
                  class="w-full px-4 py-2 rounded-xl border border-indigo-600 text-indigo-600 hover:bg-indigo-50 transition">
            View Payouts
          </button>
        </div>
      `).join('')}
    </div>
  `
}

// =====================================================
// Admin Members Module
// Review applications, record share capital, suspend/reinstate
// =====================================================

import { supabase } from './supabaseClient.js'
import { shareCapitalRef } from './membership.js'
import { formatMUR, formatDate, formatDateTime, showSuccess, showError, showEmptyState, getStatusBadge, escapeHtml, confirmAction } from './ui.js'

// ========== Fetch Memberships ==========

export const fetchMemberships = async (status = null) => {
  try {
    let query = supabase
      .from('memberships')
      .select(`
        *,
        profiles:user_id (full_name, email, phone)
      `)
      .order('applied_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching memberships:', error)
    showError('Failed to load memberships')
    return []
  }
}

// ========== Render Table ==========

const renderActions = (m) => {
  const id = escapeHtml(m.user_id)
  switch (m.status) {
    case 'PENDING':
      return `
        <button onclick="window.approveMember('${id}')" class="px-3 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm">Approve</button>
        <button onclick="window.rejectMember('${id}')" class="px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm">Reject</button>
      `
    case 'APPROVED':
      return `<button onclick="window.openShareCapitalModal('${id}')" class="px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm">Record Share Capital</button>`
    case 'ACTIVE':
      return `<button onclick="window.suspendMember('${id}')" class="px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm">Suspend</button>`
    case 'SUSPENDED':
      return `<button onclick="window.reinstateMember('${id}')" class="px-3 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm">Reinstate</button>`
    default:
      return '<span class="text-gray-400 text-sm">—</span>'
  }
}

export const renderMembershipsTable = (memberships, container) => {
  if (!memberships || memberships.length === 0) {
    showEmptyState(container, 'No membership records found', '🪪')
    return
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b-2 border-gray-200">
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Applicant</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Identity</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Applied</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Share Capital</th>
            <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${memberships.map(m => `
            <tr class="border-b border-gray-100 hover:bg-gray-50 align-top">
              <td class="px-4 py-3">
                <div class="text-sm font-semibold text-gray-800">${escapeHtml(m.profiles?.full_name || 'Unknown')}</div>
                <div class="text-xs text-gray-500">${escapeHtml(m.profiles?.email || '')}</div>
                <div class="text-xs text-gray-500">${escapeHtml(m.profiles?.phone || '')}</div>
                ${m.member_number ? `<div class="text-xs font-mono text-indigo-700 mt-1">${escapeHtml(m.member_number)}</div>` : ''}
              </td>
              <td class="px-4 py-3 text-xs text-gray-700">
                <div><span class="font-semibold">ID:</span> ${escapeHtml(m.national_id)}</div>
                <div><span class="font-semibold">DOB:</span> ${formatDate(m.date_of_birth)}</div>
                <div class="max-w-xs whitespace-pre-line"><span class="font-semibold">Address:</span> ${escapeHtml(m.address)}</div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">${formatDateTime(m.applied_at)}</td>
              <td class="px-4 py-3">
                ${getStatusBadge(m.status)}
                ${m.status_reason ? `<div class="text-xs text-gray-500 mt-1 max-w-xs">${escapeHtml(m.status_reason)}</div>` : ''}
              </td>
              <td class="px-4 py-3 text-xs text-gray-700">
                ${m.share_capital_required_mur ? `
                  <div>${formatMUR(m.share_capital_paid_mur)} / ${formatMUR(m.share_capital_required_mur)}</div>
                  <div class="text-gray-500">Ref: <span class="font-mono">${escapeHtml(shareCapitalRef(m.user_id))}</span></div>
                  ${m.share_capital_ref ? `<div class="text-gray-500">Last bank ref: ${escapeHtml(m.share_capital_ref)}</div>` : ''}
                ` : '<span class="text-gray-400">—</span>'}
              </td>
              <td class="px-4 py-3"><div class="flex flex-wrap gap-2">${renderActions(m)}</div></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

// ========== Admin Actions ==========

const callRpc = async (fn, params, successMessage) => {
  const { data, error } = await supabase.rpc(fn, params)
  if (error) {
    showError(error.message)
    return null
  }
  showSuccess(successMessage)
  return data
}

export const approveMember = async (userId) => {
  const confirmed = await confirmAction(
    'Approve this application? The applicant will then be asked to pay share capital.',
    'Approve Membership'
  )
  if (!confirmed) return null
  return callRpc('review_membership_application', { p_user_id: userId, p_approve: true, p_reason: null }, 'Application approved')
}

export const rejectMember = async (userId) => {
  const reason = window.prompt('Reason for rejection (shown to the applicant):')
  if (!reason || !reason.trim()) return null
  return callRpc('review_membership_application', { p_user_id: userId, p_approve: false, p_reason: reason.trim() }, 'Application rejected')
}

export const recordShareCapital = async (userId, amount, bankRef, paidOn) => {
  const result = await callRpc('record_share_capital_payment', {
    p_user_id: userId,
    p_amount: amount,
    p_bank_ref: bankRef,
    p_paid_on: paidOn,
  }, 'Share capital recorded')

  if (result?.status === 'ACTIVE') {
    showSuccess(`Member activated: ${result.member_number}`)
  }
  return result
}

export const suspendMember = async (userId) => {
  const reason = window.prompt('Reason for suspension (shown to the member):')
  if (!reason || !reason.trim()) return null
  return callRpc('set_membership_suspension', { p_user_id: userId, p_suspend: true, p_reason: reason.trim() }, 'Member suspended')
}

export const reinstateMember = async (userId) => {
  const confirmed = await confirmAction('Reinstate this member?', 'Reinstate Member')
  if (!confirmed) return null
  return callRpc('set_membership_suspension', { p_user_id: userId, p_suspend: false, p_reason: null }, 'Member reinstated')
}

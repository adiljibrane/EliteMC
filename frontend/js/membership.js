// =====================================================
// Membership Module
// Application, status, and member-only purchase gating
// =====================================================

import { supabase } from './supabaseClient.js'
import { formatMUR, formatDate, getStatusBadge, escapeHtml, showSuccess, showError, disableButton, enableButton } from './ui.js'

// Payment reference members use for their share capital bank transfer
export const shareCapitalRef = (userId) => `SHARE-${userId.slice(0, 8).toUpperCase()}`

// ========== Fetch Current User's Membership ==========

export const getMyMembership = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Error fetching membership:', error)
    return null
  }

  return data
}

export const isActiveMember = async () => {
  const membership = await getMyMembership()
  return membership?.status === 'ACTIVE'
}

// ========== Coop Settings ==========

export const getCoopSettings = async () => {
  const { data, error } = await supabase
    .from('coop_settings')
    .select('share_capital_mur, min_member_age')
    .maybeSingle()

  if (error) {
    console.error('Error fetching coop settings:', error)
    return null
  }

  return data
}

// ========== Submit Application ==========

export const submitApplication = async (application, button) => {
  try {
    disableButton(button, 'Submitting...')

    const { data, error } = await supabase.rpc('submit_membership_application', {
      p_full_name: application.fullName,
      p_phone: application.phone,
      p_national_id: application.nationalId,
      p_date_of_birth: application.dateOfBirth,
      p_address: application.address,
      p_accept_rules: application.acceptRules,
    })

    if (error) throw error

    showSuccess('Application submitted. An administrator will review it.')
    return data
  } catch (error) {
    showError(error.message || 'Failed to submit application')
    return null
  } finally {
    enableButton(button)
  }
}

// ========== Render Status Card ==========

export const renderMembershipStatus = (membership, container) => {
  const outstanding = membership.share_capital_required_mur
    ? parseFloat(membership.share_capital_required_mur) - parseFloat(membership.share_capital_paid_mur)
    : null

  const messages = {
    PENDING: `
      <p class="text-gray-700">Your application was submitted on ${formatDate(membership.applied_at)} and is awaiting review by the cooperative.</p>
    `,
    APPROVED: `
      <p class="text-gray-700 mb-4">Your application has been approved. To become an active member, pay your share capital by bank transfer.</p>
      <div class="bg-indigo-50 rounded-xl p-4 text-sm text-gray-800 space-y-1">
        <p><span class="font-semibold">Share capital required:</span> ${formatMUR(membership.share_capital_required_mur)}</p>
        <p><span class="font-semibold">Paid so far:</span> ${formatMUR(membership.share_capital_paid_mur)}</p>
        <p><span class="font-semibold">Outstanding:</span> ${formatMUR(outstanding)}</p>
        <p class="pt-2">Transfer to the cooperative's bank account using the reference <span class="font-mono font-semibold">${escapeHtml(shareCapitalRef(membership.user_id))}</span>. An administrator will confirm the payment.</p>
      </div>
    `,
    ACTIVE: `
      <p class="text-gray-700 mb-4">You are an active member of the cooperative and can purchase property lots.</p>
      <div class="bg-indigo-50 rounded-xl p-4 text-sm text-gray-800 space-y-1">
        <p><span class="font-semibold">Member number:</span> <span class="font-mono">${escapeHtml(membership.member_number)}</span></p>
        <p><span class="font-semibold">Member since:</span> ${formatDate(membership.activated_at)}</p>
        <p><span class="font-semibold">Share capital paid:</span> ${formatMUR(membership.share_capital_paid_mur)}</p>
      </div>
      <a href="/properties" class="inline-block mt-4 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Browse Properties</a>
    `,
    REJECTED: `
      <p class="text-gray-700 mb-2">Your application was not approved.</p>
      <p class="text-sm text-gray-600 mb-4"><span class="font-semibold">Reason:</span> ${escapeHtml(membership.status_reason)}</p>
      <p class="text-gray-700">You can correct your details and apply again below.</p>
    `,
    SUSPENDED: `
      <p class="text-gray-700 mb-2">Your membership (<span class="font-mono">${escapeHtml(membership.member_number)}</span>) is suspended. You cannot purchase lots while suspended.</p>
      <p class="text-sm text-gray-600"><span class="font-semibold">Reason:</span> ${escapeHtml(membership.status_reason)}</p>
    `,
  }

  container.innerHTML = `
    <div class="bg-white rounded-2xl shadow-md p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-2xl font-bold text-gray-800">Membership Status</h3>
        ${getStatusBadge(membership.status)}
      </div>
      ${messages[membership.status] || ''}
    </div>
  `
}

// ========== Purchase Gate (property page) ==========

export const renderMemberOnlyNotice = (membership) => {
  const text = {
    PENDING: 'Your membership application is under review. Only active members can purchase lots.',
    APPROVED: 'Your membership is approved. Pay your share capital to activate it and start purchasing lots.',
    REJECTED: 'Only active cooperative members can purchase lots. Your last application was not approved.',
    SUSPENDED: 'Your membership is suspended. Only active members can purchase lots.',
  }[membership?.status] || 'Only active cooperative members can purchase lots.'

  return `
    <div class="bg-indigo-50 rounded-xl p-4 text-center">
      <p class="text-gray-700 mb-3">${text}</p>
      <a href="/membership" class="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition">
        ${membership ? 'View Membership' : 'Become a Member'}
      </a>
    </div>
  `
}

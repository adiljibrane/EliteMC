// =====================================================
// Authentication Module
// =====================================================

import { supabase, getSession, getUser, isAdmin } from './supabaseClient.js'
import { showSuccess, showError, disableButton, enableButton } from './ui.js'

// ========== Session Management ==========

export const initAuth = async () => {
  const session = await getSession()
  updateNavigation(session)

  // Listen for auth state changes
  supabase.auth.onAuthStateChange((_event, session) => {
    updateNavigation(session)
  })
}

// Update navigation based on auth state
const updateNavigation = async (session) => {
  const authLinks = document.getElementById('auth-links')
  const userEmail = document.getElementById('user-email')

  if (!authLinks) return

  if (session) {
    const user = await getUser()
    const admin = await isAdmin()

    authLinks.innerHTML = `
      ${userEmail ? `<span class="text-gray-700 hidden md:inline">${user.email}</span>` : ''}
      <a href="/properties" class="text-gray-700 hover:text-indigo-600 transition">Properties</a>
      <a href="/wallet" class="text-gray-700 hover:text-indigo-600 transition">Wallet</a>
      <a href="/orders" class="text-gray-700 hover:text-indigo-600 transition">Orders</a>
      ${admin ? '<a href="/admin/dashboard" class="text-indigo-600 font-semibold hover:text-indigo-700 transition">Admin</a>' : ''}
      <button id="logout-btn" class="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 transition">
        Logout
      </button>
    `

    // Attach logout handler
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout)
  } else {
    authLinks.innerHTML = `
      <a href="/properties" class="text-gray-700 hover:text-indigo-600 transition">Properties</a>
      <a href="/login" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition">
        Sign In
      </a>
    `
  }
}

// ========== Sign In with OTP ==========

export const handleSignIn = async (email, button) => {
  try {
    disableButton(button, 'Sending...')

    // Use the full current URL as the redirect to ensure we're on the right deployment
    const redirectUrl = window.location.origin + '/properties'
    console.log('🔑 Sending magic link with redirect:', redirectUrl)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    })

    if (error) throw error

    showSuccess('Check your email for the login link!')
    console.log('✅ Magic link sent successfully')
    return true
  } catch (error) {
    console.error('❌ Sign in error:', error)
    const errorMessage = error?.message || error?.error_description || 'Failed to send login link. Please check Supabase email settings.'
    showError(errorMessage)
    return false
  } finally {
    enableButton(button)
  }
}

// ========== Sign Up with OTP ==========

export const handleSignUp = async (email, fullName, phone, button) => {
  try {
    disableButton(button, 'Registering...')

    // Sign up with OTP
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
        },
        emailRedirectTo: window.location.origin + '/properties',
      },
    })

    if (error) throw error

    // Create profile
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: user.id,
        full_name: fullName,
        email: email,
        phone: phone,
      })

      if (profileError && !profileError.message.includes('duplicate')) {
        console.error('Profile creation error:', profileError)
      }

      // Create initial balance
      const { error: balanceError } = await supabase.from('fiat_balances').insert({
        user_id: user.id,
        available: '0',
        locked: '0',
      })

      if (balanceError && !balanceError.message.includes('duplicate')) {
        console.error('Balance creation error:', balanceError)
      }
    }

    showSuccess('Account created! Check your email for the login link.')
    return true
  } catch (error) {
    showError(error.message)
    return false
  } finally {
    enableButton(button)
  }
}

// ========== Logout ==========

export const handleLogout = async () => {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error

    showSuccess('Logged out successfully')
    setTimeout(() => {
      window.location.href = '/'
    }, 1000)
  } catch (error) {
    showError(error.message)
  }
}

// ========== Protected Route Guard ==========

export const requireAuth = async (redirectTo = '/login') => {
  const session = await getSession()
  if (!session) {
    window.location.href = redirectTo
    return null
  }
  return session
}

// ========== Admin Guard ==========

export const requireAdmin = async (redirectTo = '/properties') => {
  const session = await requireAuth()
  if (!session) return false

  const admin = await isAdmin()
  if (!admin) {
    showError('Admin access required')
    setTimeout(() => {
      window.location.href = redirectTo
    }, 1500)
    return false
  }

  return true
}

// ========== Get Current User Profile ==========

export const getUserProfile = async () => {
  const user = await getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  return data
}

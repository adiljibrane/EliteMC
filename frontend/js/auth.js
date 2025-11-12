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
      <a href="/frontend/properties.html" class="text-gray-700 hover:text-indigo-600 transition">Properties</a>
      <a href="/frontend/wallet.html" class="text-gray-700 hover:text-indigo-600 transition">Wallet</a>
      <a href="/frontend/orders.html" class="text-gray-700 hover:text-indigo-600 transition">Orders</a>
      ${admin ? '<a href="/frontend/admin/dashboard.html" class="text-indigo-600 font-semibold hover:text-indigo-700 transition">Admin</a>' : ''}
      <button id="logout-btn" class="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 transition">
        Logout
      </button>
    `

    // Attach logout handler
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout)
  } else {
    authLinks.innerHTML = `
      <a href="/frontend/properties.html" class="text-gray-700 hover:text-indigo-600 transition">Properties</a>
      <a href="/frontend/login.html" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition">
        Sign In
      </a>
    `
  }
}

// ========== Sign In with OTP ==========

export const handleSignIn = async (email, button) => {
  try {
    disableButton(button, 'Sending...')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/frontend/properties.html',
      },
    })

    if (error) throw error

    showSuccess('Check your email for the login link!')
    return true
  } catch (error) {
    showError(error.message)
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
        emailRedirectTo: window.location.origin + '/frontend/properties.html',
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
      window.location.href = '/frontend/index.html'
    }, 1000)
  } catch (error) {
    showError(error.message)
  }
}

// ========== Protected Route Guard ==========

export const requireAuth = async (redirectTo = '/frontend/login.html') => {
  const session = await getSession()
  if (!session) {
    window.location.href = redirectTo
    return null
  }
  return session
}

// ========== Admin Guard ==========

export const requireAdmin = async (redirectTo = '/frontend/properties.html') => {
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

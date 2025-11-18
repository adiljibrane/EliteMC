// =====================================================
// Authentication Module
// =====================================================

import { supabase, getSession, getUser, isAdmin } from './supabaseClient.js'
import { showSuccess, showError, disableButton, enableButton } from './ui.js'

// ========== Session Management ==========

export const initAuth = async () => {
  const session = await getSession()
  updateNavigation(session)

  // Ensure profile exists for current user
  if (session) {
    await ensureUserProfile()
  }

  // Listen for auth state changes and sync with localStorage
  supabase.auth.onAuthStateChange(async (_event, session) => {
    updateNavigation(session)

    // Update localStorage for quick auth checks
    if (session) {
      localStorage.setItem('auth', '1')
      localStorage.setItem('user_email', session.user?.email || '')

      // Ensure profile exists when user logs in
      await ensureUserProfile()
    } else {
      localStorage.removeItem('auth')
      localStorage.removeItem('user_email')
    }
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

    // Sign up with OTP - user metadata will be stored in auth.users
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

    // Note: Profile will be created after user clicks magic link and session is established
    showSuccess('Account created! Check your email for the login link.')
    return true
  } catch (error) {
    showError(error.message)
    return false
  } finally {
    enableButton(button)
  }
}

// ========== Ensure User Profile Exists ==========

export const ensureUserProfile = async () => {
  try {
    const user = await getUser()
    if (!user) return null

    // Check if profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching profile:', fetchError)
      return null
    }

    // If profile exists, return it
    if (existingProfile) {
      return existingProfile
    }

    // Create profile if it doesn't exist
    console.log('Creating profile for user:', user.email)
    const { data: newProfile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: user.id,
        full_name: user.user_metadata?.full_name || '',
        email: user.email,
        phone: user.user_metadata?.phone || '',
      })
      .select()
      .maybeSingle()

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // If it's a duplicate error, try fetching again
      if (profileError.message?.includes('duplicate')) {
        const { data: retryProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
        if (retryProfile) return retryProfile
      }
      return null
    }

    // Create initial balance
    const { error: balanceError } = await supabase
      .from('fiat_balances')
      .insert({
        user_id: user.id,
        available: '0',
        locked: '0',
      })

    if (balanceError && !balanceError.message?.includes('duplicate')) {
      console.error('Balance creation error:', balanceError)
    }

    return newProfile
  } catch (error) {
    console.error('Error ensuring user profile:', error)
    return null
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

// ========== Session Check Helpers ==========

// Check if user is currently logged in
export const isLoggedIn = async () => {
  const session = await getSession()
  return !!session
}

// Get current user (null if not logged in)
export const getCurrentUser = async () => {
  return await getUser()
}

// Redirect to appropriate page based on login state
export const redirectBasedOnAuth = async (loggedInUrl = '/wallet', loggedOutUrl = '/login') => {
  const session = await getSession()
  if (session) {
    window.location.href = loggedInUrl
  } else {
    window.location.href = loggedOutUrl
  }
}

// Prevent logged-in users from accessing login/signup pages
export const redirectIfLoggedIn = async (redirectTo = '/wallet') => {
  const session = await getSession()
  if (session) {
    console.log('User already logged in, redirecting to', redirectTo)
    window.location.href = redirectTo
    return true
  }
  return false
}

// Setup smart logo redirect (logged in -> wallet, logged out -> home)
export const setupSmartLogo = () => {
  const logoLink = document.querySelector('a[href="/"], a[href="#"][id*="logo"]')
  if (logoLink) {
    logoLink.addEventListener('click', async (e) => {
      e.preventDefault()
      await redirectBasedOnAuth('/wallet', '/')
    })
  }
}

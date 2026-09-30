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
// Desktop (md and up): links inline. Mobile: burger button toggling a dropdown panel.
const updateNavigation = async (session) => {
  const authLinks = document.getElementById('auth-links')
  const userEmail = document.getElementById('user-email')

  if (!authLinks) return

  let links
  let email = null

  if (session) {
    const user = await getUser()
    const admin = await isAdmin()

    if (userEmail && user?.email) {
      email = user.email
    }

    links = [
      { href: '/properties', label: 'Properties' },
      { href: '/wallet', label: 'Wallet' },
      { href: '/orders', label: 'Orders' },
      { href: '/membership', label: 'Membership' },
      ...(admin ? [{ href: '/admin/dashboard', label: 'Admin', highlight: true }] : []),
      { logout: true, label: 'Logout' },
    ]
  } else {
    links = [
      { href: '/properties', label: 'Properties' },
      { href: '/login', label: 'Sign In', primary: true },
    ]
  }

  const desktopLink = (link) => {
    if (link.logout) {
      return `<button type="button" class="js-logout px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 transition">${link.label}</button>`
    }
    if (link.primary) {
      return `<a href="${link.href}" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition">${link.label}</a>`
    }
    const color = link.highlight ? 'text-indigo-600 font-semibold hover:text-indigo-700' : 'text-gray-700 hover:text-indigo-600'
    return `<a href="${link.href}" class="${color} transition">${link.label}</a>`
  }

  const mobileLink = (link) => {
    const base = 'block w-full text-left px-6 py-3 text-base border-b border-gray-100'
    if (link.logout) {
      return `<button type="button" class="js-logout ${base} text-red-600 hover:bg-gray-50">${link.label}</button>`
    }
    const color = link.primary || link.highlight ? 'text-indigo-600 font-semibold' : 'text-gray-700'
    return `<a href="${link.href}" class="${base} ${color} hover:bg-gray-50">${link.label}</a>`
  }

  authLinks.innerHTML = `
    <div class="hidden md:flex items-center gap-4">
      ${email ? `<span class="hidden lg:inline text-gray-700">${email}</span>` : ''}
      ${links.map(desktopLink).join('')}
    </div>
    <button type="button" id="nav-menu-btn" class="md:hidden p-2 -mr-2 rounded-lg text-gray-700 hover:bg-gray-100"
            aria-label="Open menu" aria-expanded="false" aria-controls="nav-menu-panel">
      <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    </button>
    <div id="nav-menu-panel" class="hidden md:hidden absolute left-0 right-0 top-full bg-white shadow-lg border-t border-gray-200">
      ${email ? `<div class="px-6 py-3 text-sm text-gray-500 border-b border-gray-100">${email}</div>` : ''}
      ${links.map(mobileLink).join('')}
    </div>
  `

  authLinks.querySelectorAll('.js-logout').forEach(btn => btn.addEventListener('click', handleLogout))
  setupMobileMenu(authLinks)
}

// ========== Mobile Menu ==========

const setMobileMenuOpen = (open) => {
  const button = document.getElementById('nav-menu-btn')
  const panel = document.getElementById('nav-menu-panel')
  if (!button || !panel) return

  panel.classList.toggle('hidden', !open)
  button.setAttribute('aria-expanded', String(open))
  button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
}

let mobileMenuGlobalListenersAttached = false

const setupMobileMenu = (authLinks) => {
  const button = document.getElementById('nav-menu-btn')
  if (!button) return

  button.addEventListener('click', (e) => {
    e.stopPropagation()
    setMobileMenuOpen(button.getAttribute('aria-expanded') !== 'true')
  })

  // Close after choosing a link
  authLinks.querySelectorAll('#nav-menu-panel a').forEach(a =>
    a.addEventListener('click', () => setMobileMenuOpen(false))
  )

  // Navigation is re-rendered on auth changes; attach document listeners once
  if (mobileMenuGlobalListenersAttached) return
  mobileMenuGlobalListenersAttached = true

  // pointerdown, not click: iOS Safari doesn't fire click for taps on non-interactive elements
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#nav-menu-btn, #nav-menu-panel')) {
      setMobileMenuOpen(false)
    }
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMobileMenuOpen(false)
  })

  // Rotating / resizing to desktop width should not leave the panel open
  window.matchMedia('(min-width: 768px)').addEventListener('change', () => setMobileMenuOpen(false))
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

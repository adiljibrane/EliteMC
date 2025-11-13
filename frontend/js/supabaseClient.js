// =====================================================
// Supabase Client Configuration
// =====================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// IMPORTANT: Replace these with your actual Supabase credentials
const SUPABASE_URL = 'https://riizybdrtikrcnrztcme.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpaXp5YmRydGlrcmNucnp0Y21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MzYxMzQsImV4cCI6MjA3ODUxMjEzNH0.xoiMkdrRBJK5JVeeBFKoz4stdyL8yO-_e726SvGke_g'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Get current session
export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Get current user
export const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Check if user is admin
export const isAdmin = async () => {
  const user = await getUser()
  return user?.app_metadata?.is_admin === true
}

// Edge Function URL helper
export const getEdgeFunctionUrl = (functionName) => {
  return `${SUPABASE_URL}/functions/v1/${functionName}`
}

// Invoke Edge Function with auth
export const invokeEdgeFunction = async (functionName, payload = {}) => {
  const session = await getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(getEdgeFunctionUrl(functionName), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json()

  if (!response.ok) {
    // Include validation details if available
    const errorMsg = data.error || 'Request failed'
    const details = data.details ? `\nDetails: ${JSON.stringify(data.details)}` : ''
    throw new Error(errorMsg + details)
  }

  return data
}

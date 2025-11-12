// =====================================================
// Supabase Client Configuration
// =====================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// IMPORTANT: Replace these with your actual Supabase credentials
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key-here'

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
    throw new Error(data.error || 'Request failed')
  }

  return data
}

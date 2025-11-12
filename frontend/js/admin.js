// =====================================================
// Admin Module - Guards & Common Functions
// =====================================================

import { supabase, invokeEdgeFunction } from './supabaseClient.js'
import { showSuccess, showError, formatMUR, formatDate } from './ui.js'

// ========== Admin Guard (already in auth.js, but duplicated for convenience) ==========

export const requireAdmin = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    window.location.href = '/frontend/login.html'
    return false
  }

  const isAdmin = user.app_metadata?.is_admin === true
  if (!isAdmin) {
    showError('Admin access required')
    setTimeout(() => {
      window.location.href = '/frontend/properties.html'
    }, 1500)
    return false
  }

  return true
}

// ========== Create Property ==========

export const createProperty = async (propertyData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('properties')
      .insert({
        ...propertyData,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    showSuccess('Property created successfully')
    return data
  } catch (error) {
    showError(error.message)
    throw error
  }
}

// ========== Update Property ==========

export const updateProperty = async (propertyId, updates) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .update(updates)
      .eq('id', propertyId)
      .select()
      .single()

    if (error) throw error

    showSuccess('Property updated successfully')
    return data
  } catch (error) {
    showError(error.message)
    throw error
  }
}

// ========== Update Property Status ==========

export const updatePropertyStatus = async (propertyId, newStatus) => {
  return updateProperty(propertyId, { status: newStatus })
}

// ========== Upload Property Images ==========

export const uploadPropertyImages = async (files, propertyId = null) => {
  try {
    const uploadedUrls = []

    for (const file of files) {
      const fileExt = file.name.split('.').pop()
      const folder = propertyId || 'temp'
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('property-images')
        .upload(fileName, file)

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('property-images')
        .getPublicUrl(fileName)

      uploadedUrls.push(publicUrl)
    }

    return uploadedUrls
  } catch (error) {
    showError('Failed to upload images')
    throw error
  }
}

// ========== Fetch All Properties (Admin) ==========

export const fetchAllProperties = async (status = null) => {
  try {
    let query = supabase
      .from('property_summary')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching properties:', error)
    return []
  }
}

// ========== Fetch Dashboard Stats ==========

export const fetchDashboardStats = async () => {
  try {
    // Fetch property stats
    const { data: properties } = await supabase
      .from('properties')
      .select('status, target_raise_mur')

    // Fetch order stats
    const { data: orders } = await supabase
      .from('orders')
      .select('status, total_price_mur')

    // Fetch pending deposits
    const { data: deposits } = await supabase
      .from('bank_deposits')
      .select('status')
      .eq('status', 'PENDING')

    // Fetch user count
    const { data: users } = await supabase
      .from('profiles')
      .select('user_id', { count: 'exact', head: true })

    const stats = {
      totalProperties: properties?.length || 0,
      openProperties: properties?.filter(p => p.status === 'OPEN').length || 0,
      totalRaised: orders
        ?.filter(o => o.status === 'PAID')
        .reduce((sum, o) => sum + parseFloat(o.total_price_mur), 0) || 0,
      pendingDeposits: deposits?.length || 0,
      totalUsers: users?.length || 0,
    }

    return stats
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return {
      totalProperties: 0,
      openProperties: 0,
      totalRaised: 0,
      pendingDeposits: 0,
      totalUsers: 0,
    }
  }
}

// ========== Fetch Audit Log ==========

export const fetchAuditLog = async (limit = 50) => {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select(`
        *,
        profiles:actor_user_id (full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching audit log:', error)
    return []
  }
}

// ========== Update Allocation Status ==========

export const updateAllocationStatus = async (allocationId, newStatus) => {
  try {
    const { data, error } = await supabase
      .from('property_allocations')
      .update({ status: newStatus })
      .eq('id', allocationId)
      .select()
      .single()

    if (error) throw error

    showSuccess(`Allocation status updated to ${newStatus}`)
    return data
  } catch (error) {
    showError(error.message)
    throw error
  }
}

// ========== Bulk Update Allocations ==========

export const bulkUpdateAllocations = async (propertyId, fromStatus, toStatus) => {
  try {
    const { data, error } = await supabase
      .from('property_allocations')
      .update({ status: toStatus })
      .eq('property_id', propertyId)
      .eq('status', fromStatus)
      .select()

    if (error) throw error

    showSuccess(`${data.length} allocations updated to ${toStatus}`)
    return data
  } catch (error) {
    showError(error.message)
    throw error
  }
}

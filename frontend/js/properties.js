// =====================================================
// Properties Module - Listing and Management
// =====================================================

import { supabase } from './supabaseClient.js'
import { formatMUR, formatDate, showSpinner, showEmptyState, getStatusBadge, createProgressBar } from './ui.js'

// ========== Fetch All Properties ==========

export const fetchProperties = async (filters = {}) => {
  try {
    let query = supabase
      .from('property_summary')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.location) {
      query = query.ilike('location', `%${filters.location}%`)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching properties:', error)
    throw error
  }
}

// ========== Fetch Single Property ==========

export const fetchProperty = async (propertyId) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching property:', error)
    throw error
  }
}

// ========== Render Property Cards ==========

export const renderPropertyCards = (properties, container) => {
  if (!properties || properties.length === 0) {
    showEmptyState(container, 'No properties available', '🏢')
    return
  }

  container.innerHTML = properties.map(property => {
    const progress = property.total_lots > 0
      ? ((property.lots_sold / property.total_lots) * 100).toFixed(1)
      : 0

    const images = Array.isArray(property.images) ? property.images : []
    const imageUrl = images[0] || '/assets/placeholders/property.jpg'

    return `
      <div class="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer"
           onclick="window.location.href='/frontend/property.html?id=${property.id}'">
        <img src="${imageUrl}" alt="${property.title}"
             class="w-full h-48 object-cover"
             onerror="this.src='/assets/placeholders/property.jpg'">

        <div class="p-6">
          <div class="flex justify-between items-start mb-2">
            <h3 class="text-xl font-bold text-gray-800">${property.title}</h3>
            ${getStatusBadge(property.status)}
          </div>

          <p class="text-gray-600 mb-4 flex items-center">
            <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
            </svg>
            ${property.location}
          </p>

          <div class="mb-4">
            <div class="flex justify-between text-sm mb-1">
              <span class="text-gray-600">Progress</span>
              <span class="font-semibold">${progress}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div class="bg-indigo-600 h-2 rounded-full transition-all" style="width: ${progress}%"></div>
            </div>
            <p class="text-xs text-gray-500 mt-1">${property.lots_sold} / ${property.total_lots} lots sold</p>
          </div>

          <div class="flex justify-between items-end">
            <div>
              <p class="text-sm text-gray-600">Price per lot</p>
              <p class="text-lg font-bold text-indigo-600">${formatMUR(property.price_per_lot)}</p>
            </div>
            <button class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
                    onclick="event.stopPropagation(); window.location.href='/frontend/property.html?id=${property.id}'">
              View Details
            </button>
          </div>
        </div>
      </div>
    `
  }).join('')
}

// ========== Fetch Property Stats (for Admin) ==========

export const fetchPropertyStats = async (propertyId) => {
  try {
    const { data, error } = await supabase
      .from('property_summary')
      .select('*')
      .eq('id', propertyId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching property stats:', error)
    throw error
  }
}

// ========== Fetch Property Allocations (for Admin) ==========

export const fetchPropertyAllocations = async (propertyId) => {
  try {
    const { data, error } = await supabase
      .from('property_allocations')
      .select(`
        *,
        profiles:user_id (full_name, email, wallet_ss58)
      `)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching allocations:', error)
    throw error
  }
}

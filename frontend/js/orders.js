// =====================================================
// Orders Module
// =====================================================

import { supabase, requireUser } from './supabaseClient.js'
import { formatMUR, formatDateTime, showEmptyState, getStatusBadge } from './ui.js'

// ========== Fetch User Orders ==========

export const fetchOrders = async (filters = {}) => {
  try {
    const user = await requireUser()

    let query = supabase
      .from('orders')
      .select(`
        *,
        properties:property_id (
          title,
          location,
          images
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching orders:', error)
    return []
  }
}

// ========== Render Orders Table ==========

export const renderOrdersTable = (orders, container) => {
  if (!orders || orders.length === 0) {
    showEmptyState(container, 'No orders yet', '📦')
    return
  }

  container.innerHTML = `
    <div class="space-y-4">
      ${orders.map(order => {
        const property = order.properties
        const images = property?.images ? (Array.isArray(property.images) ? property.images : []) : []
        const imageUrl = images[0] || '/assets/placeholders/property.jpg'

        return `
          <div class="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition">
            <div class="flex flex-col md:flex-row gap-6">
              <!-- Property Image -->
              <img src="${imageUrl}" alt="${property?.title || 'Property'}"
                   class="w-full md:w-32 h-32 object-cover rounded-xl"
                   onerror="this.src='/assets/placeholders/property.jpg'">

              <!-- Order Details -->
              <div class="flex-1">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <h3 class="text-lg font-bold text-gray-800">${property?.title || 'Unknown Property'}</h3>
                    <p class="text-sm text-gray-600">${property?.location || ''}</p>
                  </div>
                  ${getStatusBadge(order.status)}
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                  <div>
                    <p class="text-gray-600">Lots</p>
                    <p class="font-semibold text-gray-800">${order.lots}</p>
                  </div>
                  <div>
                    <p class="text-gray-600">Unit Price</p>
                    <p class="font-semibold text-gray-800">${formatMUR(order.unit_price_mur)}</p>
                  </div>
                  <div>
                    <p class="text-gray-600">Total</p>
                    <p class="font-semibold text-indigo-600">${formatMUR(order.total_price_mur)}</p>
                  </div>
                  <div>
                    <p class="text-gray-600">Order Date</p>
                    <p class="font-semibold text-gray-800">${formatDateTime(order.created_at)}</p>
                  </div>
                </div>

                ${order.paid_at ? `
                  <p class="text-xs text-gray-500 mt-2">Paid on ${formatDateTime(order.paid_at)}</p>
                ` : ''}
              </div>

              <!-- Action Button -->
              <div class="flex items-center">
                <button onclick="window.location.href='/property?id=${order.property_id}'"
                        class="px-4 py-2 rounded-xl border border-indigo-600 text-indigo-600 hover:bg-indigo-50 transition whitespace-nowrap">
                  View Property
                </button>
              </div>
            </div>
          </div>
        `
      }).join('')}
    </div>
  `
}

// ========== Fetch Order Stats ==========

export const fetchOrderStats = async () => {
  try {
    const user = await requireUser()

    const { data: orders, error } = await supabase
      .from('orders')
      .select('status, total_price_mur')
      .eq('user_id', user.id)

    if (error) throw error

    const stats = {
      total: orders.length,
      paid: orders.filter(o => o.status === 'PAID').length,
      pending: orders.filter(o => o.status === 'PENDING_PAYMENT').length,
      totalSpent: orders
        .filter(o => o.status === 'PAID')
        .reduce((sum, o) => sum + parseFloat(o.total_price_mur), 0),
    }

    return stats
  } catch (error) {
    console.error('Error fetching order stats:', error)
    return { total: 0, paid: 0, pending: 0, totalSpent: 0 }
  }
}

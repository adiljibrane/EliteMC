// =====================================================
// Property Detail & Buy Flow Module
// =====================================================

import { supabase, invokeEdgeFunction } from './supabaseClient.js'
import { formatMUR, showSuccess, showError, disableButton, enableButton, openModal, closeModal } from './ui.js'

// ========== Create Order ==========

export const createOrder = async (propertyId, lots, unitPrice) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        property_id: propertyId,
        lots: lots,
        unit_price_mur: unitPrice.toString(),
        status: 'PENDING_PAYMENT',
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating order:', error)
    throw error
  }
}

// ========== Capture Order (Pay) ==========

export const captureOrder = async (orderId, idempotencyKey = null) => {
  try {
    const payload = {
      order_id: orderId,
    }

    if (idempotencyKey) {
      payload.idempotency_key = idempotencyKey
    }

    const result = await invokeEdgeFunction('capture_order', payload)
    return result
  } catch (error) {
    console.error('Error capturing order:', error)
    throw error
  }
}

// ========== Handle Buy Flow ==========

export const handleBuyProperty = async (propertyId, lots, unitPrice, button) => {
  try {
    disableButton(button, 'Processing...')

    // Step 1: Create order
    const order = await createOrder(propertyId, lots, unitPrice)

    // Step 2: Capture payment
    const idempotencyKey = `${order.id}-${Date.now()}`
    const result = await captureOrder(order.id, idempotencyKey)

    showSuccess(`Purchase successful! You now own ${lots} lot(s).`)

    // Close modal and refresh
    closeModal('buy-modal')
    setTimeout(() => {
      window.location.reload()
    }, 1500)

    return result
  } catch (error) {
    showError(error.message || 'Purchase failed')
    throw error
  } finally {
    enableButton(button)
  }
}

// ========== Check User Balance ==========

export const getUserBalance = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('fiat_balances')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return data || { available: '0', locked: '0' }
  } catch (error) {
    console.error('Error fetching balance:', error)
    return { available: '0', locked: '0' }
  }
}

// ========== Setup Buy Modal ==========

export const setupBuyModal = async (property) => {
  const modal = document.getElementById('buy-modal')
  if (!modal) return

  const lotsInput = document.getElementById('lots-input')
  const totalPriceDisplay = document.getElementById('total-price')
  const buyButton = document.getElementById('confirm-buy-btn')
  const balanceDisplay = document.getElementById('balance-display')

  // Fetch and display balance
  const balance = await getUserBalance()
  if (balanceDisplay) {
    balanceDisplay.textContent = `Available Balance: ${formatMUR(balance.available)}`
  }

  // Update total price on input change
  const updateTotalPrice = () => {
    const lots = parseInt(lotsInput.value) || 0
    const totalPrice = lots * parseFloat(property.price_per_lot)
    totalPriceDisplay.textContent = formatMUR(totalPrice)

    // Check if user has sufficient balance
    const available = parseFloat(balance.available)
    if (totalPrice > available) {
      buyButton.disabled = true
      buyButton.classList.add('opacity-50', 'cursor-not-allowed')
      balanceDisplay.classList.add('text-red-600')
    } else {
      buyButton.disabled = false
      buyButton.classList.remove('opacity-50', 'cursor-not-allowed')
      balanceDisplay.classList.remove('text-red-600')
    }
  }

  lotsInput.addEventListener('input', updateTotalPrice)
  updateTotalPrice()

  // Handle buy button click
  buyButton.addEventListener('click', async () => {
    const lots = parseInt(lotsInput.value)

    if (lots < property.min_lot_purchase) {
      showError(`Minimum purchase is ${property.min_lot_purchase} lot(s)`)
      return
    }

    const totalPrice = lots * parseFloat(property.price_per_lot)
    const available = parseFloat(balance.available)

    if (totalPrice > available) {
      showError('Insufficient balance. Please deposit funds first.')
      return
    }

    await handleBuyProperty(property.id, lots, property.price_per_lot, buyButton)
  })
}

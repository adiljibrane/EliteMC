// =====================================================
// UI Utilities - Toasts, Modals, Loaders, Formatters
// =====================================================

// ========== Formatters ==========

export const formatMUR = (amount) => {
  const num = parseFloat(amount)
  if (isNaN(num)) return 'MUR 0.00'
  return `MUR ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// ========== Toast Notifications ==========

export const showToast = (message, type = 'info') => {
  const toast = document.createElement('div')
  toast.className = `fixed top-4 right-4 z-50 max-w-sm p-4 rounded-2xl shadow-lg transform transition-all duration-300 translate-x-0`

  const colors = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-yellow-500 text-white',
    info: 'bg-blue-500 text-white',
  }

  toast.className += ` ${colors[type] || colors.info}`
  toast.textContent = message

  document.body.appendChild(toast)

  // Animate in
  setTimeout(() => toast.classList.add('opacity-100'), 10)

  // Remove after 4 seconds
  setTimeout(() => {
    toast.classList.add('translate-x-full', 'opacity-0')
    setTimeout(() => toast.remove(), 300)
  }, 4000)
}

export const showSuccess = (message) => showToast(message, 'success')
export const showError = (message) => showToast(message, 'error')
export const showWarning = (message) => showToast(message, 'warning')
export const showInfo = (message) => showToast(message, 'info')

// ========== Loading Spinner ==========

export const showSpinner = (targetElement) => {
  const spinner = document.createElement('div')
  spinner.className = 'flex justify-center items-center py-8'
  spinner.innerHTML = `
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  `
  spinner.setAttribute('data-spinner', 'true')
  targetElement.innerHTML = ''
  targetElement.appendChild(spinner)
}

export const hideSpinner = (targetElement) => {
  const spinner = targetElement.querySelector('[data-spinner="true"]')
  if (spinner) spinner.remove()
}

// ========== Skeleton Loader ==========

export const createSkeletonCard = () => {
  return `
    <div class="bg-white rounded-2xl shadow-md p-6 animate-pulse">
      <div class="h-48 bg-gray-300 rounded-xl mb-4"></div>
      <div class="h-4 bg-gray-300 rounded mb-2"></div>
      <div class="h-4 bg-gray-300 rounded w-2/3"></div>
    </div>
  `
}

// ========== Empty State ==========

export const showEmptyState = (targetElement, message = 'No data available', icon = '📭') => {
  targetElement.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12 text-gray-500">
      <div class="text-6xl mb-4">${icon}</div>
      <p class="text-lg">${message}</p>
    </div>
  `
}

// ========== Error Banner ==========

export const showErrorBanner = (targetElement, message) => {
  const banner = document.createElement('div')
  banner.className = 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4'
  banner.innerHTML = `
    <div class="flex items-center">
      <span class="text-xl mr-2">⚠️</span>
      <p>${message}</p>
    </div>
  `
  targetElement.insertBefore(banner, targetElement.firstChild)
}

// ========== Modal Management ==========

export const openModal = (modalId) => {
  const modal = document.getElementById(modalId)
  if (modal) {
    modal.classList.remove('hidden')
    modal.classList.add('flex')
    document.body.style.overflow = 'hidden'
  }
}

export const closeModal = (modalId) => {
  const modal = document.getElementById(modalId)
  if (modal) {
    modal.classList.add('hidden')
    modal.classList.remove('flex')
    document.body.style.overflow = ''
  }
}

// Close modal on background click
export const setupModalClose = (modalId) => {
  const modal = document.getElementById(modalId)
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modalId)
      }
    })
  }
}

// ========== Confirmation Dialog ==========

export const confirmAction = async (message, title = 'Confirm Action') => {
  return new Promise((resolve) => {
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-bold mb-4">${title}</h3>
        <p class="text-gray-700 mb-6">${message}</p>
        <div class="flex gap-3 justify-end">
          <button id="cancel-btn" class="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50">
            Cancel
          </button>
          <button id="confirm-btn" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
            Confirm
          </button>
        </div>
      </div>
    `
    document.body.appendChild(modal)

    modal.querySelector('#confirm-btn').addEventListener('click', () => {
      modal.remove()
      resolve(true)
    })

    modal.querySelector('#cancel-btn').addEventListener('click', () => {
      modal.remove()
      resolve(false)
    })

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove()
        resolve(false)
      }
    })
  })
}

// ========== Status Badges ==========

export const getStatusBadge = (status) => {
  const statusConfig = {
    // Property statuses
    'DRAFT': { label: 'Draft', color: 'bg-gray-200 text-gray-700' },
    'OPEN': { label: 'Open', color: 'bg-green-200 text-green-800' },
    'READY_TO_MINT': { label: 'Ready to Mint', color: 'bg-blue-200 text-blue-800' },
    'MINTED': { label: 'Minted', color: 'bg-purple-200 text-purple-800' },
    'CLOSED': { label: 'Closed', color: 'bg-gray-200 text-gray-700' },

    // Order statuses
    'PENDING_PAYMENT': { label: 'Pending', color: 'bg-yellow-200 text-yellow-800' },
    'PAID': { label: 'Paid', color: 'bg-green-200 text-green-800' },
    'CANCELLED': { label: 'Cancelled', color: 'bg-red-200 text-red-800' },
    'FAILED': { label: 'Failed', color: 'bg-red-200 text-red-800' },

    // Allocation statuses
    'RESERVED': { label: 'Reserved', color: 'bg-yellow-200 text-yellow-800' },
    'SETTLED_OFFCHAIN': { label: 'Settled', color: 'bg-green-200 text-green-800' },
    'ONCHAIN_SETTLED': { label: 'On-Chain', color: 'bg-purple-200 text-purple-800' },
    'REVOKED': { label: 'Revoked', color: 'bg-red-200 text-red-800' },

    // Deposit statuses
    'PENDING': { label: 'Pending', color: 'bg-yellow-200 text-yellow-800' },
    'MATCHED': { label: 'Matched', color: 'bg-green-200 text-green-800' },
    'REJECTED': { label: 'Rejected', color: 'bg-red-200 text-red-800' },

    // KYC statuses
    'APPROVED': { label: 'Approved', color: 'bg-green-200 text-green-800' },
  }

  const config = statusConfig[status] || { label: status, color: 'bg-gray-200 text-gray-700' }
  return `<span class="px-3 py-1 rounded-full text-xs font-semibold ${config.color}">${config.label}</span>`
}

// ========== Progress Bar ==========

export const createProgressBar = (current, total) => {
  const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0
  return `
    <div class="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
      <div class="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
    </div>
    <p class="text-sm text-gray-600 mt-1">${current} / ${total} lots (${percentage.toFixed(1)}%)</p>
  `
}

// ========== Disable/Enable Button ==========

export const disableButton = (button, loadingText = 'Loading...') => {
  button.disabled = true
  button.dataset.originalText = button.textContent
  button.textContent = loadingText
  button.classList.add('opacity-50', 'cursor-not-allowed')
}

export const enableButton = (button) => {
  button.disabled = false
  button.textContent = button.dataset.originalText || button.textContent
  button.classList.remove('opacity-50', 'cursor-not-allowed')
}

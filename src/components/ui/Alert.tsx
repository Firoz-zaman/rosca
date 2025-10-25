'use client'

interface AlertProps {
  type: 'error' | 'success' | 'info'
  message: string
  onClose?: () => void
}

export function Alert({ type, message, onClose }: AlertProps) {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }

  const icons = {
    error: '⚠️',
    success: '✅',
    info: 'ℹ️'
  }

  return (
    <div
      className={`${styles[type]} border-2 rounded-lg p-4 flex items-start gap-3 animate-slideDown`}
      role="alert"
    >
      <span className="text-xl">{icons[type]}</span>
      <div className="flex-1">
        <p className="font-medium">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-lg hover:opacity-70 transition"
          aria-label="Close alert"
        >
          ×
        </button>
      )}
    </div>
  )
}

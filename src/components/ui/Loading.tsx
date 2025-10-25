'use client'

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-3',
    lg: 'w-8 h-8 border-4'
  }

  return (
    <div
      className={`${sizeClasses[size]} border-t-transparent border-white rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    />
  )
}

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <p className="text-slate-600 text-lg font-medium">{message}</p>
      </div>
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <LoadingSpinner size="lg" />
    </div>
  )
}

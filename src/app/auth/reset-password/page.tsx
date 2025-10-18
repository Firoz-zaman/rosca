'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      alert('Password updated successfully!')
      router.push('/auth/signin')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-12">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-2xl border border-slate-200">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Set New Password</h2>
          <p className="text-slate-700 mt-2">Enter your new password below</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-600 text-red-900 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-5">
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-slate-900 mb-2">
              New Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition placeholder:text-slate-500"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-900 mb-2">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition placeholder:text-slate-500"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition shadow-lg hover:shadow-xl"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

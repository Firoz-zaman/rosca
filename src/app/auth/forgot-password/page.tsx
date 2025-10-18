'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) throw error

      setMessage('Check your email for the password reset link!')
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
          <h2 className="text-3xl font-bold text-slate-900">Forgot Password?</h2>
          <p className="text-slate-700 mt-2">We&apos;ll send you a reset link</p>
        </div>

        {message && (
          <div className="bg-green-50 border-l-4 border-green-600 text-green-900 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Success!</p>
            <p className="text-sm">{message}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-600 text-red-900 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-900 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition placeholder:text-slate-500"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition shadow-lg hover:shadow-xl"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-700 mt-6">
          Remember your password?{' '}
          <Link href="/auth/signin" className="text-blue-700 hover:text-blue-800 font-bold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}

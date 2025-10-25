'use client'

import { useState } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LoadingSpinner } from '../../../components/ui/Loading'
import { Alert } from '../../../components/ui/Alert'
import { validateEmail } from '../../../lib/validation'

export default function SignInPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Basic validation
      const emailValidation = validateEmail(formData.email)
      if (!emailValidation.isValid) {
        throw new Error('Invalid credentials')
      }

      if (!formData.password) {
        throw new Error('Invalid credentials')
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) throw new Error('Invalid credentials') // Generic error

      router.push('/dashboard')
      router.refresh()
    } catch (error: any) {
      // Always show generic error to prevent username enumeration
      setError('Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      })

      if (error) throw error
    } catch (error: any) {
      setError('Sign-in failed. Please try again.')
    }
  }



  const handleAppleSignIn = async () => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    })

    if (error) throw error
  } catch (error: any) {
    setError(error.message || 'Apple sign-in failed')
  }
}


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome Back
            </h1>
            <p className="text-slate-600">Sign in to your account</p>
          </div>

          {error && (
            <div className="mb-6">
              <Alert type="error" message={error} onClose={() => setError(null)} />
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition placeholder:text-slate-500"
                placeholder="you@example.com"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition placeholder:text-slate-500"
                placeholder="••••••••"
                disabled={loading}
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <Link
                href="/auth/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium transition"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:ring-blue-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Signing In...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="mt-4 w-full bg-white border-2 border-slate-300 text-slate-700 py-3 px-6 rounded-lg font-semibold hover:bg-slate-50 focus:ring-4 focus:ring-slate-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center justify-center gap-2">
                🔍 Sign in with Google
              </span>
            </button>

              <button
                onClick={handleAppleSignIn}
                disabled={loading}
                className="mt-4 w-full bg-black border-2 border-black text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  🍎 Sign `in with Apple
                </span>
              </button>


          </div>

          <p className="mt-8 text-center text-slate-600">
            Don't have an account?{' '}
            <Link
              href="/auth/signup"
              className="text-blue-600 font-semibold hover:text-blue-700 transition"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}



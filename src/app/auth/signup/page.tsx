'use client'

import { useState } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LoadingSpinner } from '../../../components/ui/Loading'
import { Alert } from '../../../components/ui/Alert'
import {
  validateEmail,
  validatePassword,
  validateName,
  validatePasswordMatch
} from '../../../lib/validation'

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  // Real-time field validation
  const validateField = (field: string, value: string) => {
    let validation
    
    switch (field) {
      case 'email':
        validation = validateEmail(value)
        break
      case 'password':
        validation = validatePassword(value)
        break
      case 'name':
        validation = validateName(value)
        break
      case 'confirmPassword':
        validation = validatePasswordMatch(formData.password, value)
        break
      default:
        return
    }

    setErrors(prev => ({
      ...prev,
      [field]: validation.isValid ? '' : validation.error || ''
    }))
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleBlur = (field: string) => {
    validateField(field, formData[field as keyof typeof formData])
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setGlobalError(null)

    // Validate all fields
    const nameValidation = validateName(formData.name)
    const emailValidation = validateEmail(formData.email)
    const passwordValidation = validatePassword(formData.password)
    const matchValidation = validatePasswordMatch(
      formData.password,
      formData.confirmPassword
    )

    const newErrors: Record<string, string> = {}
    
    if (!nameValidation.isValid) newErrors.name = nameValidation.error!
    if (!emailValidation.isValid) newErrors.email = emailValidation.error!
    if (!passwordValidation.isValid) newErrors.password = passwordValidation.error!
    if (!matchValidation.isValid) newErrors.confirmPassword = matchValidation.error!

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)

    try {
      // Server-side validation
      const validateResponse = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          type: 'signup'
        })
      })

      if (!validateResponse.ok) {
        const data = await validateResponse.json()
        throw new Error(data.error || 'Validation failed')
      }

      // Sign up
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) throw error

      if (data?.user?.identities?.length === 0) {
        setGlobalError('An account with this email already exists')
        return
      }

      setSuccess(true)
      
      // Check if email confirmation is required
      if (data.user && !data.session) {
        setGlobalError('Please check your email to confirm your account')
      } else {
        setTimeout(() => router.push('/dashboard'), 1500)
      }
    } catch (error: any) {
      setGlobalError(error.message || 'An error occurred during sign up')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
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
      setGlobalError(error.message || 'Google sign-in failed')
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
    setGlobalError(error.message || 'Apple sign-in failed')
  }
}






  if (success && !globalError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Account Created!
          </h2>
          <p className="text-slate-600">Redirecting to dashboard...</p>
          <div className="mt-6">
            <LoadingSpinner size="md" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Create Account
            </h1>
            <p className="text-slate-600">Join us today</p>
          </div>

          {globalError && (
            <div className="mb-6">
              <Alert type="error" message={globalError} onClose={() => setGlobalError(null)} />
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                onBlur={() => handleBlur('name')}
                className={`w-full px-4 py-3 text-slate-900 bg-white border-2 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition placeholder:text-slate-500 ${
                  errors.name ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="John Doe"
                disabled={loading}
                required
              />
              {errors.name && (
                <p className="text-red-600 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                className={`w-full px-4 py-3 text-slate-900 bg-white border-2 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition placeholder:text-slate-500 ${
                  errors.email ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="you@example.com"
                disabled={loading}
                required
              />
              {errors.email && (
                <p className="text-red-600 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                onBlur={() => handleBlur('password')}
                className={`w-full px-4 py-3 text-slate-900 bg-white border-2 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition placeholder:text-slate-500 ${
                  errors.password ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="••••••••"
                disabled={loading}
                required
              />
              {errors.password && (
                <p className="text-red-600 text-sm mt-1">{errors.password}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Min 8 chars, 1 uppercase, 1 lowercase, 1 number
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700 mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                className={`w-full px-4 py-3 text-slate-900 bg-white border-2 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition placeholder:text-slate-500 ${
                  errors.confirmPassword ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="••••••••"
                disabled={loading}
                required
              />
              {errors.confirmPassword && (
                <p className="text-red-600 text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:ring-blue-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Creating Account...</span>
                </>
              ) : (
                'Create Account'
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

            {/* <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="mt-4 w-full bg-white border-2 border-slate-300 text-slate-700 py-3 px-6 rounded-lg font-semibold hover:bg-slate-50 focus:ring-4 focus:ring-slate-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center justify-center gap-2">
                🔍 Sign up with Google
              </span>
            </button>
          


            <button
              onClick={handleAppleSignIn}
              disabled={loading}
              className="mt-4 w-full bg-black border-2 border-black text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span className="flex items-center justify-center gap-2">
                  🍎 Sign up with Apple
                </span>
            </button> */}

            </div>


          <p className="mt-8 text-center text-slate-600">
            Already have an account?{' '}
            <Link
              href="/auth/signin"
              className="text-blue-600 font-semibold hover:text-blue-700 transition"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}



import { NextRequest, NextResponse } from 'next/server'
import { validateEmail, validatePassword, validateName } from '../../../../lib/validation'

// Rate limiting map (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const limit = rateLimitMap.get(ip)

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 }) // 1 minute
    return true
  }

  if (limit.count >= 10) {
    return false
  }

  limit.count++
  return true
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const { email, password, name, type } = body

    // Validate based on type
    if (type === 'signup') {
      const emailValidation = validateEmail(email)
      if (!emailValidation.isValid) {
        return NextResponse.json(
          { error: emailValidation.error },
          { status: 400 }
        )
      }

      const passwordValidation = validatePassword(password)
      if (!passwordValidation.isValid) {
        return NextResponse.json(
          { error: passwordValidation.error },
          { status: 400 }
        )
      }

      const nameValidation = validateName(name)
      if (!nameValidation.isValid) {
        return NextResponse.json(
          { error: nameValidation.error },
          { status: 400 }
        )
      }
    }

    if (type === 'signin') {
      const emailValidation = validateEmail(email)
      if (!emailValidation.isValid) {
        return NextResponse.json(
          { error: 'Invalid credentials' }, // Generic error
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Validation failed' },
      { status: 400 }
    )
  }
}

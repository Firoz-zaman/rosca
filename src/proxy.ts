import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // 🔒 SECURITY FIX: Block CVE-2025-29927 middleware bypass
  if (request.headers.get('x-middleware-subrequest')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })
  // ... rest of your existing code stays exactly the same


  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Use getUser() not getSession() for security
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect dashboard routes - redirect to signin if not authenticated
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    request.nextUrl.pathname.startsWith('/dashboard')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/signin'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (
    user &&
    (request.nextUrl.pathname.startsWith('/auth/signin') ||
      request.nextUrl.pathname.startsWith('/auth/signup'))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/protected/:path*',
    '/auth/signin',
    '/auth/signup',
  ],
}

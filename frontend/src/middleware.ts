import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const pad = base64.length % 4
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64
    const jsonStr = atob(padded)
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const refreshCookie = request.cookies.get('refresh_token')?.value
  const { pathname } = request.nextUrl
  const isPublicRoute = pathname === '/auth/login' || pathname === '/privacy' || pathname === '/terms'
  
  if (!refreshCookie) {
    if (!isPublicRoute) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    return NextResponse.next()
  }
  
  const payload = decodeJwtPayload(refreshCookie)
  const isExpired = !payload || (payload.exp && payload.exp * 1000 < Date.now())

  if (isExpired) {
    const redirectRes = isPublicRoute
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/auth/login', request.url))
    redirectRes.cookies.delete('refresh_token')
    return redirectRes
  }

  const role = payload.role

  if (pathname === '/auth/login' || pathname === '/') {
    return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url))
  }
  
  // Ensure role matches the route group
  if (pathname.startsWith('/superadmin') && role !== 'superadmin') {
    return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url))
  }
  if (pathname.startsWith('/admin') && role !== 'admin' && role !== 'superadmin') {
    return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url))
  }
  if (pathname.startsWith('/faculty') && role !== 'faculty' && role !== 'superadmin') {
    return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url))
  }
  if (pathname.startsWith('/student') && role !== 'student' && role !== 'superadmin') {
    return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

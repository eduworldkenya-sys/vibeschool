import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/teacher/:path*',
    '/academy/:path*',
    '/global/:path*',
    '/admin/:path*',
    '/parent/:path*',
    '/student/:path*',
    '/select/:path*',
  ],
}

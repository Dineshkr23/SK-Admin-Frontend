import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const path = request.nextUrl.pathname;
  if (path === '/login') {
    return NextResponse.next();
  }
  // Token is in localStorage on client; we can't read it in middleware.
  // So we don't redirect here; the client-side will redirect on 401.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Simple edge routing middleware to ensure access headers and routes are matched
  const pathname = request.nextUrl.pathname;
  
  // We can log access to SaaS portals
  console.log(`[Middleware Check] Route: ${pathname}`);

  return NextResponse.next();
}

export const config = {
  // Match SaaS and Onboarding workspace routes
  matcher: ['/org/:path*', '/billing/:path*', '/onboard/:path*'],
};

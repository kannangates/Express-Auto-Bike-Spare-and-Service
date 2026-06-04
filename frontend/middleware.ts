// Next.js 16+ middleware configuration
import { NextRequest, NextResponse } from 'next/server'

// Define public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/simple-login',
  '/auth/callback',
  '/approval-pending',
  '/unauthorized',
  '/offline',
  '/api/health',
  '/manifest.json',
  '/sw.js',
  '/favicon.ico',
  '/_next',
  '/public',
  '/robots.txt',
  '/browserconfig.xml',
  '/icons',
];

// Define role-based route access
const roleRoutes = {
  '/admin': ['OWNER'],
  '/inventory': ['OWNER', 'OPERATIONS', 'CASHIER'],
  '/orders': ['OWNER', 'OPERATIONS', 'CASHIER', 'DELIVERY'],
  '/returns': ['OWNER', 'OPERATIONS', 'CASHIER'],
  '/reports': ['OWNER', 'OPERATIONS'],
  '/users': ['OWNER'],
  '/settings': ['OWNER'],
  '/scan': ['OWNER', 'OPERATIONS', 'CASHIER'],
};

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route => pathname.startsWith(route));
}

function getUserRoleFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;

    // NOTE: The edge middleware cannot verify the JWT signature (secret not available at edge).
    // This decode is used ONLY for routing decisions (role-based redirects).
    // All API requests are re-verified by the Django backend with full signature validation.
    // Do not use middleware-decoded claims for security-critical decisions in components.
    const payload = JSON.parse(atob(parts[1]));

    // Reject expired tokens — signature is verified at the API level
    if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) return null;

    return payload.role || null;
  } catch {
    return null;
  }
}

function isUserApproved(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return false;

    const payload = JSON.parse(atob(parts[1]));
    return payload.is_approved === true;
  } catch {
    return false;
  }
}

function hasRouteAccess(pathname: string, userRole: string): boolean {
  // Find matching route pattern
  const matchingRoute = Object.keys(roleRoutes).find(route =>
    pathname.startsWith(route)
  );

  if (!matchingRoute) {
    // If no specific route restriction, allow access for authenticated users
    return true;
  }

  const allowedRoles = roleRoutes[matchingRoute as keyof typeof roleRoutes];
  return allowedRoles.includes(userRole);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check authentication
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    // Redirect to login if not authenticated
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Get user role from token
  const userRole = getUserRoleFromToken(token);

  if (!userRole) {
    // Invalid token, redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth-token');
    return response;
  }

  // Check if user is approved
  if (!isUserApproved(token)) {
    return NextResponse.redirect(new URL('/approval-pending', request.url));
  }

  // Check role-based access
  if (!hasRouteAccess(pathname, userRole)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  // Add user role to request headers for use in components
  const response = NextResponse.next();
  response.headers.set('x-user-role', userRole);
  response.headers.set('x-user-approved', 'true');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public|robots.txt|browserconfig.xml).*)',
  ],
};
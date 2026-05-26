'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This app uses Google OAuth exclusively.
// /simple-login is kept as a route so old bookmarks don't 404, but it
// immediately redirects to the real login page.
export default function SimpleLoginRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/login'); }, [router]);
  return null;
}

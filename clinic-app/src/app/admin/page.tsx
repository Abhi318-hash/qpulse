'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// /admin has been retired and replaced by /super-admin.
// This redirect ensures all existing bookmarks continue to work.
export default function AdminPageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/super-admin');
  }, [router]);

  return null;
}

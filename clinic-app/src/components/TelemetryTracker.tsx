'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { sendTelemetryEvent } from '@/lib/telemetry';

function TrackerContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    sendTelemetryEvent('page_view', {
      search: searchParams?.toString() || ''
    });
  }, [pathname, searchParams]);

  return null;
}

export default function TelemetryTracker() {
  return (
    <Suspense fallback={null}>
      <TrackerContent />
    </Suspense>
  );
}

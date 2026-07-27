function getBrowserName() {
  if (typeof window === 'undefined') return 'server';
  const ua = window.navigator.userAgent;
  if (ua.includes('Chrome')) return 'chrome';
  if (ua.includes('Firefox')) return 'firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'safari';
  return 'other';
}

export function sendTelemetryEvent(action: string, metadata: Record<string, any> = {}) {
  if (typeof window === 'undefined') return;
  
  const payload = {
    event_id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
    timestamp: new Date().toISOString(),
    user_id: metadata.userId || 'anonymous',
    url: window.location.pathname,
    action: action,
    referrer: document.referrer || 'direct',
    device: /Mobi|Android/i.test(window.navigator.userAgent) ? 'mobile' : 'desktop',
    browser: getBrowserName(),
    ...metadata
  };
  
  fetch('http://localhost:8000/api/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    mode: 'cors',
    keepalive: true
  }).catch(err => console.debug('Telemetry ingestion offline', err));
}

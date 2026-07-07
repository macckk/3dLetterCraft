// Stub. Wire this to GA / Plausible / PostHog later.
export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.debug('[analytics]', name, props)
  }
}

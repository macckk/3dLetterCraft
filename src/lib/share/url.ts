import type { ControlValues } from '@/templates/types'

const PARAM = 'd'

export type ShareState = { templateId: string; values: ControlValues }

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
}

export function encodeState(state: ShareState): string {
  return toBase64Url(JSON.stringify(state))
}

export function decodeState(encoded: string): ShareState | null {
  try {
    const obj = JSON.parse(fromBase64Url(encoded))
    if (typeof obj !== 'object' || obj === null) return null
    if (typeof obj.templateId !== 'string' || typeof obj.values !== 'object') return null
    return obj as ShareState
  } catch {
    return null
  }
}

export function buildShareUrl(state: ShareState): string {
  const url = new URL(window.location.href)
  url.hash = ''
  url.search = ''
  url.searchParams.set(PARAM, encodeState(state))
  return url.toString()
}

/** Read `?d=…` from the current URL and remove it (History API). */
export function consumeShareParam(): ShareState | null {
  const url = new URL(window.location.href)
  const enc = url.searchParams.get(PARAM)
  if (!enc) return null
  const state = decodeState(enc)
  // Clean the URL so refreshes don't re-hydrate.
  url.searchParams.delete(PARAM)
  window.history.replaceState({}, '', url.toString())
  return state
}

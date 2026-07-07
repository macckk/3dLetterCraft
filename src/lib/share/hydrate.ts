import { useDesignStore } from '@/store/design'
import { consumeShareParam } from './url'

/** Call once at startup, before React renders. */
export function hydrateFromShareUrl(): void {
  const state = consumeShareParam()
  if (!state) return
  const store = useDesignStore.getState()
  // Load defaults for the incoming template, then merge shared values on top.
  store.setTemplate(state.templateId)
  store.applyPreset(state.values)
}

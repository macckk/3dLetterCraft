import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ControlValues } from '@/templates/types'
import { templates } from '@/templates/registry'

type DesignState = {
  templateId: string
  values: ControlValues
  setTemplate: (id: string) => void
  setValue: (key: string, value: string | number | boolean) => void
  applyPreset: (partial: Partial<ControlValues>) => void
  reset: () => void
}

function defaultsFor(templateId: string): ControlValues {
  const tpl = templates.find((t) => t.id === templateId) ?? templates[0]
  const out: ControlValues = {}
  for (const c of tpl.controls) out[c.id] = c.default
  return out
}

const initialTemplateId = templates[0]?.id ?? ''

export const useDesignStore = create<DesignState>()(
  persist(
    (set) => ({
      templateId: initialTemplateId,
      values: defaultsFor(initialTemplateId),
      setTemplate: (id) => set({ templateId: id, values: defaultsFor(id) }),
      setValue: (key, value) =>
        set((s) => ({ values: { ...s.values, [key]: value } })),
      applyPreset: (partial) =>
        set((s) => {
          const next: ControlValues = { ...s.values }
          for (const [k, v] of Object.entries(partial)) {
            if (v !== undefined) next[k] = v
          }
          return { values: next }
        }),
      reset: () => set((s) => ({ values: defaultsFor(s.templateId) })),
    }),
    { name: 'lettercraft:design' }
  )
)

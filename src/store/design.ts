import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ControlValues } from '@/templates/types'
import { templates } from '@/templates/registry'

type DesignState = {
  templateId: string
  values: ControlValues
  setTemplate: (id: string) => void
  setValue: (key: string, value: string | number | boolean) => void
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
      reset: () => set((s) => ({ values: defaultsFor(s.templateId) })),
    }),
    { name: 'lettercraft:design' }
  )
)

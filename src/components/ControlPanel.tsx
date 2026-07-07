import { useTranslation } from 'react-i18next'
import { useDesignStore } from '@/store/design'
import { getTemplate } from '@/templates/registry'
import type { ControlType } from '@/templates/types'

const AVAILABLE_FONTS = {
  serif:  ['Cardo'],
  script: ['Sacramento'],
  sans:   [],
}

export function ControlPanel() {
  const { t } = useTranslation()
  const templateId = useDesignStore((s) => s.templateId)
  const values = useDesignStore((s) => s.values)
  const setValue = useDesignStore((s) => s.setValue)
  const reset = useDesignStore((s) => s.reset)

  const tpl = getTemplate(templateId)
  if (!tpl) return null

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      <div>
        <div className="text-xs uppercase tracking-wider text-neutral-400">
          {t(tpl.nameKey)}
        </div>
        <div className="text-sm text-neutral-500">{t(tpl.descriptionKey)}</div>
      </div>

      <div className="flex flex-col gap-3">
        {tpl.controls
          .filter((c) => !c.visibleWhen || c.visibleWhen(values))
          .map((c) => (
            <Control key={c.id} control={c} value={values[c.id]} onChange={(v) => setValue(c.id, v)} />
          ))}
      </div>

      <button
        onClick={reset}
        className="mt-2 self-start text-xs text-neutral-400 hover:text-neutral-200 underline"
      >
        {t('actions.reset')}
      </button>
    </div>
  )
}

function Control({
  control,
  value,
  onChange,
}: {
  control: ControlType
  value: string | number | boolean
  onChange: (v: string | number | boolean) => void
}) {
  const { t } = useTranslation()
  const label = t(control.labelKey)

  switch (control.kind) {
    case 'text':
      return (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-300">{label}</span>
          <input
            type="text"
            maxLength={control.maxLength}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
          />
        </label>
      )
    case 'number':
      return (
        <label className="flex flex-col gap-1">
          <div className="flex justify-between text-sm text-neutral-300">
            <span>{label}</span>
            <span className="text-neutral-400 tabular-nums">
              {Number(value).toFixed(control.step < 1 ? 1 : 0)}
              {control.unit ? ` ${control.unit}` : ''}
            </span>
          </div>
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="accent-indigo-500"
          />
        </label>
      )
    case 'color':
      return (
        <label className="flex items-center justify-between gap-2">
          <span className="text-sm text-neutral-300">{label}</span>
          <input
            type="color"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-8 bg-transparent border border-neutral-700 rounded"
          />
        </label>
      )
    case 'font': {
      const list = AVAILABLE_FONTS[control.category ?? 'serif']
      return (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-300">{label}</span>
          <select
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
          >
            {list.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
      )
    }
    case 'toggle':
      return (
        <label className="flex items-center justify-between gap-2">
          <span className="text-sm text-neutral-300">{label}</span>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="accent-indigo-500 w-4 h-4"
          />
        </label>
      )
  }
}

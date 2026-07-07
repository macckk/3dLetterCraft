import { useEffect, useState } from 'react'
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
        <NumberControl
          label={label}
          min={control.min}
          max={control.max}
          step={control.step}
          unit={control.unit}
          value={Number(value)}
          onChange={(n) => onChange(n)}
        />
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

function NumberControl({
  label,
  min,
  max,
  step,
  unit,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  unit?: string
  value: number
  onChange: (n: number) => void
}) {
  // Local text state so typing doesn't fight controlled updates.
  // Committed to parent on blur / Enter.
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(formatValue(value, step))
  }, [value, step])

  function commit() {
    const n = Number(text)
    if (!Number.isFinite(n)) {
      setText(formatValue(value, step))
      return
    }
    const clamped = Math.min(Math.max(n, min), max)
    onChange(clamped)
    setText(formatValue(clamped, step))
  }

  return (
    <label className="flex flex-col gap-1">
      <div className="flex justify-between items-center text-sm">
        <span className="text-neutral-300">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            className="w-16 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-xs text-right tabular-nums text-neutral-100 focus:outline-none focus:border-indigo-500"
          />
          {unit && <span className="text-neutral-400 text-xs w-4">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-indigo-500"
      />
    </label>
  )
}

function formatValue(n: number, step: number): string {
  const decimals = step < 1 ? Math.max(1, -Math.floor(Math.log10(step))) : 0
  return n.toFixed(decimals)
}

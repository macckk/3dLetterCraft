import { useTranslation } from 'react-i18next'
import { useDesignStore } from '@/store/design'
import { getTemplate } from '@/templates/registry'

export function Validator() {
  const { t } = useTranslation()
  const templateId = useDesignStore((s) => s.templateId)
  const values = useDesignStore((s) => s.values)

  const tpl = getTemplate(templateId)
  const issues = tpl?.validate?.(values) ?? []
  if (issues.length === 0) return null

  return (
    <div className="flex flex-col gap-1 rounded border border-amber-500/30 bg-amber-500/5 p-2">
      <div className="text-xs uppercase tracking-wider text-amber-400">
        {t('validation.title', { count: issues.length })}
      </div>
      <ul className="flex flex-col gap-0.5 text-xs text-amber-100/90">
        {issues.map((iss, i) => (
          <li key={i} className="flex gap-1.5">
            <span aria-hidden>{iss.severity === 'error' ? '⛔' : '⚠️'}</span>
            <span>{t(iss.messageKey, iss.params)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

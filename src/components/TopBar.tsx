import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getTemplate } from '@/templates/registry'
import { useDesignStore } from '@/store/design'
import { exportSTL } from '@/lib/export/stl'
import { buildShareUrl } from '@/lib/share/url'
import { trackEvent } from '@/analytics'

export function TopBar() {
  const { t, i18n } = useTranslation()
  const templateId = useDesignStore((s) => s.templateId)
  const values = useDesignStore((s) => s.values)
  const [copied, setCopied] = useState(false)

  function toggleLang() {
    const next = i18n.language.startsWith('pt') ? 'en' : 'pt'
    void i18n.changeLanguage(next)
    trackEvent('lang_change', { to: next })
  }

  async function share() {
    const url = buildShareUrl({ templateId, values })
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
      trackEvent('share_url', { templateId })
    } catch {
      window.prompt(t('actions.shareFallback'), url)
    }
  }

  async function download() {
    const tpl = getTemplate(templateId)
    if (!tpl) return
    const group = await Promise.resolve(tpl.build({ values, t, mode: 'export' }))
    const safeName = String(values.name ?? 'design').trim() || 'design'
    if (tpl.getExportables) {
      for (const part of tpl.getExportables(group)) {
        exportSTL(part.object, `${safeName}-${part.label}.stl`)
      }
    } else {
      exportSTL(group, `${safeName}.stl`)
    }
    trackEvent('download_stl', { templateId })
  }

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-950/60 backdrop-blur">
      <div className="flex items-baseline gap-3">
        <h1 className="text-lg font-semibold tracking-tight">{t('app.title')}</h1>
        <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          {t('app.free')}
        </span>
        <span className="hidden md:inline text-sm text-neutral-400">{t('app.tagline')}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleLang}
          className="text-xs px-2 py-1 rounded border border-neutral-700 hover:border-neutral-500 text-neutral-300"
          title={t('actions.language')}
        >
          {i18n.language.toUpperCase().slice(0, 2)}
        </button>
        <button
          onClick={share}
          className="text-xs px-2.5 py-1.5 rounded border border-neutral-700 hover:border-neutral-500 text-neutral-300"
          title={t('actions.share')}
        >
          {copied ? t('actions.shareCopied') : t('actions.share')}
        </button>
        <button
          onClick={download}
          className="text-sm px-3 py-1.5 rounded bg-indigo-500 hover:bg-indigo-400 text-white font-medium"
        >
          {t('nav.download')}
        </button>
      </div>
    </header>
  )
}

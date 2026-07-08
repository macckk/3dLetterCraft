import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { getTemplate } from '@/templates/registry'
import { useDesignStore } from '@/store/design'
import { exportSTL } from '@/lib/export/stl'
import { buildShareUrl } from '@/lib/share/url'
import { trackEvent } from '@/analytics'

export function TopBar() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const inEditor = location.pathname.startsWith('/editor/')
  const templateId = useDesignStore((s) => s.templateId)
  const values = useDesignStore((s) => s.values)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

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
    setDownloading(true)
    // Let the browser paint the "Baixando STLs..." state before we start
    // the (potentially heavy) synchronous CSG / extrusion work.
    await new Promise((r) => setTimeout(r, 30))
    try {
      const group = await Promise.resolve(tpl.build({ values, t, mode: 'export' }))
    // Template inputs use `name` or `text` depending on the template; fall back
    // to `initial1+initial2` for couple initials.
    const raw =
      (values.text as string | undefined) ??
      (values.name as string | undefined) ??
      ((values.initial1 as string | undefined) && (values.initial2 as string | undefined)
        ? `${values.initial1}${values.initial2}`
        : undefined) ??
      'design'
    const safeName = String(raw).trim().replace(/[^\w\-]+/g, '_') || 'design'
      if (tpl.getExportables) {
        // Sequential download with a small delay — Chrome silently blocks
        // multiple downloads fired in the same tick.
        const parts = tpl.getExportables(group)
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i]
          exportSTL(part.object, `${safeName}-${part.label}.stl`)
          if (i < parts.length - 1) await new Promise((r) => setTimeout(r, 350))
        }
      } else {
        exportSTL(group, `${safeName}.stl`)
      }
      trackEvent('download_stl', { templateId })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-950/60 backdrop-blur">
      <div className="flex items-baseline gap-3">
        <Link to="/" className="text-lg font-semibold tracking-tight hover:text-indigo-300 transition-colors">
          {t('app.title')}
        </Link>
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
        {inEditor && (
          <>
            <button
              onClick={share}
              className="text-xs px-2.5 py-1.5 rounded border border-neutral-700 hover:border-neutral-500 text-neutral-300"
              title={t('actions.share')}
            >
              {copied ? t('actions.shareCopied') : t('actions.share')}
            </button>
            <button
              onClick={download}
              disabled={downloading}
              className="text-sm px-3 py-1.5 rounded bg-indigo-500 hover:bg-indigo-400 text-white font-medium disabled:opacity-70 disabled:cursor-wait inline-flex items-center gap-2"
            >
              {downloading && (
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {downloading ? t('status.downloadingStls') : t('nav.download')}
            </button>
          </>
        )}
      </div>
    </header>
  )
}

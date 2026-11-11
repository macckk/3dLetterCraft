import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { getTemplate } from '@/templates/registry'
import { useDesignStore } from '@/store/design'
import { exportSTL } from '@/lib/export/stl'
import { downloadSVG } from '@/lib/export/svgExport'
import { downloadDXF } from '@/lib/export/dxfExport'
import { downloadPDF } from '@/lib/export/pdfExport'
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
  const [svgMenuOpen, setSvgMenuOpen] = useState(false)
  const svgMenuRef = useRef<HTMLDivElement>(null)

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
    if (!tpl || !tpl.build) return
    setDownloading(true)
    await new Promise((r) => setTimeout(r, 30))
    try {
      const group = await Promise.resolve(tpl.build({ values, t, mode: 'export' }))
      const raw =
        (values.text as string | undefined) ??
        (values.name as string | undefined) ??
        ((values.initial1 as string | undefined) && (values.initial2 as string | undefined)
          ? `${values.initial1}${values.initial2}`
          : undefined) ??
        'design'
      const safeName = String(raw).trim().replace(/[^\w\-]+/g, '_') || 'design'
      if (tpl.getExportables) {
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

  function downloadSVGTemplate(format: 'svg' | 'pdf' | 'dxf') {
    const tpl = getTemplate(templateId)
    if (!tpl?.buildSVG) return
    setSvgMenuOpen(false)
    const geo = tpl.buildSVG({ values, t })
    const filename = `box-${Number(values.boxWidth)}x${Number(values.boxDepth)}x${Number(values.boxHeight)}`
    if (format === 'svg') downloadSVG(geo, filename)
    else if (format === 'dxf') downloadDXF(geo, filename)
    else downloadPDF(geo, filename)
    trackEvent('download_2d', { templateId, format })
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
            {getTemplate(templateId)?.type === 'svg' ? (
              <div ref={svgMenuRef} className="relative">
                <button
                  onClick={() => setSvgMenuOpen((o) => !o)}
                  className="text-sm px-3 py-1.5 rounded bg-indigo-500 hover:bg-indigo-400 text-white font-medium inline-flex items-center gap-1.5"
                >
                  {t('nav.downloadTemplate')}
                  <span className="text-xs opacity-80">▾</span>
                </button>
                {svgMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 bg-neutral-800 border border-neutral-700 rounded shadow-lg z-50 min-w-[120px]"
                    onMouseLeave={() => setSvgMenuOpen(false)}
                  >
                    {(['svg', 'pdf', 'dxf'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => downloadSVGTemplate(fmt)}
                        className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 uppercase tracking-wide"
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
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
            )}
          </>
        )}
      </div>
    </header>
  )
}

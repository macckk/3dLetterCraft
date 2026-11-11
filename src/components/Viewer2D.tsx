import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getTemplate } from '@/templates/registry'
import { useDesignStore } from '@/store/design'
import type { BoxTemplate2D, Path2D } from '@/lib/geometry/boxTemplate'

function pathToD(pts: Array<[number, number]>, closed: boolean, ox: number, oy: number): string {
  if (pts.length === 0) return ''
  const [first, ...rest] = pts
  const parts = [`M${(first[0] + ox).toFixed(2)},${(first[1] + oy).toFixed(2)}`]
  for (const [x, y] of rest) parts.push(`L${(x + ox).toFixed(2)},${(y + oy).toFixed(2)}`)
  if (closed) parts.push('Z')
  return parts.join(' ')
}

export function Viewer2D() {
  const { t } = useTranslation()
  const templateId = useDesignStore((s) => s.templateId)
  const values = useDesignStore((s) => s.values)
  const tpl = getTemplate(templateId)

  const geo: BoxTemplate2D | null = useMemo(() => {
    if (!tpl?.buildSVG) return null
    return tpl.buildSVG({ values, t })
  }, [tpl, values, t])

  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fitToContainer = useCallback(() => {
    if (!geo || !containerRef.current) return
    const { width: cw, height: ch } = containerRef.current.getBoundingClientRect()
    if (cw === 0 || ch === 0) return
    const PAD = 40
    const svgW = geo.width + 10
    const svgH = geo.height + 10
    const s = Math.min((cw - PAD * 2) / svgW, (ch - PAD * 2) / svgH)
    const clampedScale = Math.max(0.05, Math.min(s, 10))
    setScale(clampedScale)
    setPan({
      x: (cw - svgW * clampedScale) / 2,
      y: (ch - svgH * clampedScale) / 2,
    })
  }, [geo])

  useEffect(() => {
    fitToContainer()
  }, [fitToContainer])

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    setScale((s) => Math.max(0.05, Math.min(20, s * factor)))
  }

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    panRef.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!panRef.current) return
    setPan({
      x: panRef.current.px + e.clientX - panRef.current.mx,
      y: panRef.current.py + e.clientY - panRef.current.my,
    })
  }

  function stopPan() { panRef.current = null }

  if (!geo) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        {t('status.rendering')}
      </div>
    )
  }

  const PAD = 5
  const svgW = geo.width + PAD * 2
  const svgH = geo.height + PAD * 2

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-neutral-800 cursor-grab active:cursor-grabbing select-none"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
    >
      <div
        style={{
          transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ background: '#fff', display: 'block', boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
        >
          {/* Millimetre grid */}
          <defs>
            <pattern id="mm-grid" width="1" height="1" patternUnits="userSpaceOnUse">
              <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#e8e8e8" strokeWidth="0.05" />
            </pattern>
            <pattern id="cm-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <rect width="10" height="10" fill="url(#mm-grid)" />
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#d0d0d0" strokeWidth="0.1" />
            </pattern>
          </defs>
          <rect width={svgW} height={svgH} fill="url(#cm-grid)" />

          {/* Cut lines */}
          <g fill="none" stroke="#e53e3e" strokeWidth="0.3">
            {geo.cutPaths.map((p: Path2D, i: number) => (
              <path key={i} d={pathToD(p.points, p.closed, PAD, PAD)} />
            ))}
          </g>

          {/* Score / fold lines */}
          <g fill="none" stroke="#3182ce" strokeWidth="0.2" strokeDasharray="3,2">
            {geo.scorePaths.map((p: Path2D, i: number) => (
              <path key={i} d={pathToD(p.points, p.closed, PAD, PAD)} />
            ))}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 flex gap-3 text-xs bg-neutral-900/90 px-3 py-2 rounded pointer-events-none">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t-2 border-red-500" />
          {t('viewer2d.cut')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t-2 border-blue-400 border-dashed" />
          {t('viewer2d.score')}
        </span>
      </div>

      {/* Dimensions + fit button */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <span className="text-xs bg-neutral-900/90 px-2.5 py-1.5 rounded text-neutral-300 pointer-events-none">
          {geo.width.toFixed(1)} × {geo.height.toFixed(1)} mm
        </span>
        <button
          onClick={fitToContainer}
          className="text-xs bg-neutral-900/90 px-2.5 py-1.5 rounded text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          title={t('viewer2d.fitToView')}
        >
          ⊡
        </button>
      </div>
    </div>
  )
}

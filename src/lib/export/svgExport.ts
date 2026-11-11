import type { BoxTemplate2D, Path2D } from '../geometry/boxTemplate'

function pathToD(pts: Array<[number, number]>, closed: boolean, ox = 0, oy = 0): string {
  if (pts.length === 0) return ''
  const [first, ...rest] = pts
  const parts = [`M ${(first[0] + ox).toFixed(3)} ${(first[1] + oy).toFixed(3)}`]
  for (const [x, y] of rest) parts.push(`L ${(x + ox).toFixed(3)} ${(y + oy).toFixed(3)}`)
  if (closed) parts.push('Z')
  return parts.join(' ')
}

function renderPaths(paths: Path2D[], ox: number, oy: number): string {
  return paths.map((p) => `    <path d="${pathToD(p.points, p.closed, ox, oy)}" />`).join('\n')
}

export function buildSVG(tpl: BoxTemplate2D): string {
  const PAD = 5
  const W = tpl.width + PAD * 2
  const H = tpl.height + PAD * 2

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${W.toFixed(2)}mm" height="${H.toFixed(2)}mm"
     viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}">
  <!-- CUT lines (red) -->
  <g id="cut" fill="none" stroke="#ff0000" stroke-width="0.1">
${renderPaths(tpl.cutPaths, PAD, PAD)}
  </g>
  <!-- SCORE / fold lines (blue dashed) -->
  <g id="score" fill="none" stroke="#0000ff" stroke-width="0.1" stroke-dasharray="2,2">
${renderPaths(tpl.scorePaths, PAD, PAD)}
  </g>
</svg>`
}

export function downloadSVG(tpl: BoxTemplate2D, filename: string): void {
  const svg = buildSVG(tpl)
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.svg') ? filename : filename + '.svg'
  a.click()
  URL.revokeObjectURL(url)
}

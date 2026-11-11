import type { BoxTemplate2D } from '../geometry/boxTemplate'
import { buildSVG } from './svgExport'

export function downloadPDF(tpl: BoxTemplate2D, filename: string): void {
  const svg = buildSVG(tpl)
  const W = (tpl.width + 10).toFixed(1)
  const H = (tpl.height + 10).toFixed(1)
  const baseName = filename.replace(/\.(pdf|svg)$/i, '')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${baseName}</title>
<style>
  @page { size: ${W}mm ${H}mm; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; }
  svg { display: block; width: ${W}mm; height: ${H}mm; }
</style>
</head>
<body>
${svg}
<script>
  window.onload = function() {
    window.focus();
    window.print();
  };
<\/script>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  // Revoke after a delay so the window can load it
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  if (!win) {
    // Popup blocked: fall back to SVG download
    const svgBlob = new Blob([svg], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(svgBlob)
    a.download = baseName + '.svg'
    a.click()
  }
}

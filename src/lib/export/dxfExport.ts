import type { BoxTemplate2D, Path2D } from '../geometry/boxTemplate'

function lwpolyline(path: Path2D, layer: string, totalH: number): string {
  const { points, closed } = path
  let s = `  0\nLWPOLYLINE\n  8\n${layer}\n 90\n${points.length}\n 70\n${closed ? 1 : 0}\n`
  for (const [x, y] of points) {
    // DXF Y-axis goes up; flip relative to template height
    s += ` 10\n${x.toFixed(4)}\n 20\n${(totalH - y).toFixed(4)}\n`
  }
  return s
}

export function buildDXF(tpl: BoxTemplate2D): string {
  const H = tpl.height

  const entities = [
    ...tpl.cutPaths.map((p) => lwpolyline(p, 'CUT', H)),
    ...tpl.scorePaths.map((p) => lwpolyline(p, 'SCORE', H)),
  ].join('')

  return [
    '  0', 'SECTION', '  2', 'HEADER',
    '  9', '$ACADVER', '  1', 'AC1015',
    '  9', '$INSUNITS', ' 70', '4',      // 4 = millimetres
    '  0', 'ENDSEC',
    '  0', 'SECTION', '  2', 'TABLES',
    '  0', 'TABLE', '  2', 'LAYER', ' 70', '2',
    '  0', 'LAYER', '  2', 'CUT',   ' 70', '0', ' 62', '1', '  6', 'CONTINUOUS',
    '  0', 'LAYER', '  2', 'SCORE', ' 70', '0', ' 62', '5', '  6', 'DASHED',
    '  0', 'ENDTAB', '  0', 'ENDSEC',
    '  0', 'SECTION', '  2', 'ENTITIES',
    entities,
    '  0', 'ENDSEC', '  0', 'EOF',
  ].join('\n')
}

export function downloadDXF(tpl: BoxTemplate2D, filename: string): void {
  const dxf = buildDXF(tpl)
  const blob = new Blob([dxf], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.dxf') ? filename : filename + '.dxf'
  a.click()
  URL.revokeObjectURL(url)
}

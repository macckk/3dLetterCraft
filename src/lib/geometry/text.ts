import { ExtrudeGeometry, Shape, Path, Vector2 } from 'three'
import type { Font } from 'opentype.js'

// opentype path commands (subset we handle)
type Cmd =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'Q'; x: number; y: number; x1: number; y1: number }
  | { type: 'C'; x: number; y: number; x1: number; y1: number; x2: number; y2: number }
  | { type: 'Z' }

interface Contour {
  commands: Cmd[]
  polyline: Vector2[]
  signedArea: number
}

/**
 * Convert a text string into an ExtrudeGeometry using an opentype Font.
 * Positive Y is up (Three.js convention). The result is centered on origin (X, Y),
 * flat on the XY plane, extruded along +Z by `depth`.
 */
export function extrudeText(
  text: string,
  font: Font,
  opts: { size: number; depth: number; curveSegments?: number }
): ExtrudeGeometry {
  const shapes = textToShapes(text, font, opts.size)
  const geom = new ExtrudeGeometry(shapes, {
    depth: opts.depth,
    bevelEnabled: false,
    curveSegments: opts.curveSegments ?? 6,
  })
  // Center on X/Y (keep base of extrusion at z=0)
  geom.computeBoundingBox()
  const bb = geom.boundingBox!
  const cx = (bb.min.x + bb.max.x) / 2
  const cy = (bb.min.y + bb.max.y) / 2
  geom.translate(-cx, -cy, 0)
  return geom
}

export function textToShapes(text: string, font: Font, size: number): Shape[] {
  const path = font.getPath(text, 0, 0, size)
  const commands = path.commands as Cmd[]

  const contours = splitContours(commands).map(buildContour)
  const outers = contours.filter((c) => c.signedArea > 0)
  const holes = contours.filter((c) => c.signedArea < 0)

  const shapes: Shape[] = outers.map((o) => contourToShape(o.commands))

  for (const hole of holes) {
    // Find the outer contour that contains the first vertex of the hole.
    const seed = hole.polyline[0]
    const owner = outers.findIndex((o) => pointInPolygon(o.polyline, seed))
    if (owner >= 0) {
      shapes[owner].holes.push(contourToPath(hole.commands))
    }
    // Orphan holes (should be rare) are silently dropped.
  }
  return shapes
}

// ─── internal helpers ────────────────────────────────────────────────────────

function splitContours(commands: Cmd[]): Cmd[][] {
  const out: Cmd[][] = []
  let cur: Cmd[] = []
  for (const c of commands) {
    if (c.type === 'M' && cur.length > 0) {
      out.push(cur)
      cur = []
    }
    cur.push(c)
  }
  if (cur.length > 0) out.push(cur)
  return out
}

function contourToShape(cmds: Cmd[]): Shape {
  const s = new Shape()
  applyCommands(s, cmds)
  return s
}

function contourToPath(cmds: Cmd[]): Path {
  const p = new Path()
  applyCommands(p, cmds)
  return p
}

// Apply opentype commands to a Path/Shape, negating Y to convert
// canvas-down to Three.js-up.
function applyCommands(target: Path, cmds: Cmd[]): void {
  for (const c of cmds) {
    switch (c.type) {
      case 'M': target.moveTo(c.x, -c.y); break
      case 'L': target.lineTo(c.x, -c.y); break
      case 'Q': target.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y); break
      case 'C': target.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y); break
      case 'Z': break
    }
  }
}

function buildContour(cmds: Cmd[]): Contour {
  const polyline = commandsToPolyline(cmds)
  return { commands: cmds, polyline, signedArea: signedArea(polyline) }
}

// Sample bezier curves so signed area and containment are accurate.
function commandsToPolyline(cmds: Cmd[]): Vector2[] {
  const pts: Vector2[] = []
  let x = 0, y = 0
  const SEGMENTS = 8
  for (const c of cmds) {
    switch (c.type) {
      case 'M':
        x = c.x; y = -c.y
        pts.push(new Vector2(x, y))
        break
      case 'L':
        x = c.x; y = -c.y
        pts.push(new Vector2(x, y))
        break
      case 'Q': {
        const ex = c.x, ey = -c.y
        const cx = c.x1, cy = -c.y1
        for (let i = 1; i <= SEGMENTS; i++) {
          const t = i / SEGMENTS
          const it = 1 - t
          const px = it * it * x + 2 * it * t * cx + t * t * ex
          const py = it * it * y + 2 * it * t * cy + t * t * ey
          pts.push(new Vector2(px, py))
        }
        x = ex; y = ey
        break
      }
      case 'C': {
        const ex = c.x, ey = -c.y
        const c1x = c.x1, c1y = -c.y1
        const c2x = c.x2, c2y = -c.y2
        for (let i = 1; i <= SEGMENTS; i++) {
          const t = i / SEGMENTS
          const it = 1 - t
          const px = it * it * it * x + 3 * it * it * t * c1x + 3 * it * t * t * c2x + t * t * t * ex
          const py = it * it * it * y + 3 * it * it * t * c1y + 3 * it * t * t * c2y + t * t * t * ey
          pts.push(new Vector2(px, py))
        }
        x = ex; y = ey
        break
      }
      case 'Z': break
    }
  }
  return pts
}

// Shoelace formula. > 0 means counter-clockwise in Three.js Y-up.
function signedArea(pts: Vector2[]): number {
  let a = 0
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n]
    a += (q.x - p.x) * (q.y + p.y)
  }
  return -a / 2
}

// Ray casting point-in-polygon.
function pointInPolygon(poly: Vector2[], p: Vector2): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if (((a.y > p.y) !== (b.y > p.y)) &&
        (p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)) {
      inside = !inside
    }
  }
  return inside
}

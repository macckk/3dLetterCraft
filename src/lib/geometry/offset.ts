import { Shape, Vector2 } from 'three'
import type { Path } from 'three'

/**
 * Signed area of a closed polygon. Positive = CCW winding.
 */
function signedArea(pts: Vector2[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

/**
 * Offset a closed polygon perpendicular to its edges by `d`.
 * Positive `d` grows CCW polygons outward (and CW polygons inward).
 * Sharp corners are replaced by a bevel/chamfer (two vertices offset from
 * each incident edge) to avoid the long miter spikes that vertex-bisector
 * offset produces at acute exterior angles — which is exactly what a
 * script font like Pacifico creates at swash endpoints.
 */
function offsetPolygon(pts: Vector2[], d: number): Vector2[] {
  const n = pts.length
  const ccw = signedArea(pts) > 0
  const sign = ccw ? 1 : -1
  const normals: Vector2[] = []
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    normals.push(new Vector2(sign * dy / len, sign * -dx / len))
  }
  // Below this cos-half-angle we switch from mitered corners to beveled ones.
  // 0.5 ≈ 60° full angle — anything sharper gets chamfered.
  const MITER_MIN_COS = 0.5
  const out: Vector2[] = []
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const nIn = normals[(i - 1 + n) % n]
    const nOut = normals[i]
    let bx = nIn.x + nOut.x
    let by = nIn.y + nOut.y
    const bl = Math.hypot(bx, by)
    if (bl < 1e-6) {
      // Ends of a nearly 180° reflex — one vertex on the outgoing normal is fine.
      out.push(new Vector2(p.x + nOut.x * d, p.y + nOut.y * d))
      continue
    }
    bx /= bl; by /= bl
    const cos = bx * nOut.x + by * nOut.y
    if (cos < MITER_MIN_COS) {
      // Sharp corner — chamfer with two points offset from each edge.
      out.push(new Vector2(p.x + nIn.x * d, p.y + nIn.y * d))
      out.push(new Vector2(p.x + nOut.x * d, p.y + nOut.y * d))
    } else {
      const scale = d / cos
      out.push(new Vector2(p.x + bx * scale, p.y + by * scale))
    }
  }
  return out
}

function polygonToShape(pts: Vector2[]): Shape {
  const s = new Shape()
  s.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, pts[i].y)
  return s
}

/**
 * Grow each glyph shape by `d` mm outward. Outer contours are pushed outward,
 * inner holes (letter counters like the loop of 'o') shrink inward. A hole
 * that would collapse (self-intersect) is dropped from the output plate.
 * Perfect for the classic "letter-hugging outline" keychain look.
 */
export function outlineTextShapes(
  glyphs: Shape[],
  d: number,
  divisions = 16,
): Shape[] {
  if (d <= 0) return glyphs.map((g) => g.clone() as Shape)
  const result: Shape[] = []
  for (const g of glyphs) {
    const outerPts = g.getPoints(divisions)
    if (outerPts.length < 3) continue
    const grownOuter = offsetPolygon(outerPts, d)
    if (Math.sign(signedArea(outerPts)) !== Math.sign(signedArea(grownOuter))) continue
    // Fill the letter counters (interior of 'o', 'e', etc.) by dropping holes.
    // The classic "outline keychain" look expects a solid plate under each glyph.
    result.push(polygonToShape(grownOuter))
  }
  return result
}

/**
 * Combined bounding box of a set of shapes (outer contours only — good enough
 * for centering text glyphs).
 */
export function shapesBounds(shapes: Shape[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const s of shapes) {
    for (const p of s.getPoints(4)) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
  }
  return { minX, maxX, minY, maxY }
}

/**
 * Translate every curve inside a Shape (contour + holes) by (dx, dy).
 * Handles the LineCurve / QuadraticBezier / SplineCurve endpoints that
 * three.js typography produces.
 */
export function shiftShape(shape: Shape, dx: number, dy: number): void {
  const dv = new Vector2(dx, dy)
  const shiftCurves = (curves: Path['curves']) => {
    for (const c of curves) {
      const anyC = c as unknown as Record<string, Vector2 | Vector2[] | undefined>
      for (const key of ['v0', 'v1', 'v2', 'v3']) {
        const p = anyC[key] as Vector2 | undefined
        if (p && typeof (p as Vector2).x === 'number') p.add(dv)
      }
      const points = (c as unknown as { points?: Vector2[] }).points
      if (Array.isArray(points)) for (const p of points) p.add(dv)
    }
  }
  shiftCurves(shape.curves)
  for (const hole of shape.holes) shiftCurves(hole.curves)
}

import { Path, Shape, Vector2 } from 'three'
import polygonClipping from 'polygon-clipping'

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
  // 1) Offset each glyph outline outward and drop the letter counters so 'o',
  //    'e', 'a' render as solid blobs (the classic outline-keychain look).
  const grown: Vector2[][] = []
  for (const g of glyphs) {
    const outerPts = g.getPoints(divisions)
    if (outerPts.length < 3) continue
    const grownOuter = offsetPolygon(outerPts, d)
    if (Math.sign(signedArea(outerPts)) !== Math.sign(signedArea(grownOuter))) continue
    grown.push(grownOuter)
  }
  if (grown.length === 0) return []
  // 2) 2D-union the overlapping offset polygons (adjacent cursive letters share
  //    ink) so the resulting plate is a single seamless region — no internal
  //    walls, no side cracks in the exported STL. polygon-clipping is O(n log n)
  //    and finishes in a handful of ms even for long names.
  const rings = grown.map<[number, number][][]>((poly) => [poly.map((p) => [p.x, p.y] as [number, number])])
  const merged = polygonClipping.union(rings[0], ...rings.slice(1))
  const shapes: Shape[] = []
  for (const multi of merged) {
    if (multi.length === 0) continue
    const outer = multi[0]
    if (outer.length < 3) continue
    const shape = new Shape()
    shape.moveTo(outer[0][0], outer[0][1])
    for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i][0], outer[i][1])
    // Any holes reported by the union are actual regions surrounded by ink —
    // preserve them so, e.g., the plate matches the negative space between
    // letters correctly.
    for (let h = 1; h < multi.length; h++) {
      const hole = multi[h]
      if (hole.length < 3) continue
      const path = new Path()
      path.moveTo(hole[0][0], hole[0][1])
      for (let i = 1; i < hole.length; i++) path.lineTo(hole[i][0], hole[i][1])
      shape.holes.push(path)
    }
    shapes.push(shape)
  }
  return shapes
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

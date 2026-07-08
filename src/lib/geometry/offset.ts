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
/**
 * Convert one closed polygon (as a ring of [x,y] pairs) into a three.js Shape.
 * Rounds coordinates to 3 decimals so polygon-clipping's near-coincident
 * vertex handling stays stable across calls.
 */
function ringToShape(outer: [number, number][], holes: [number, number][][] = []): Shape | null {
  if (outer.length < 3) return null
  const shape = new Shape()
  shape.moveTo(outer[0][0], outer[0][1])
  for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i][0], outer[i][1])
  for (const hole of holes) {
    if (hole.length < 3) continue
    const path = new Path()
    path.moveTo(hole[0][0], hole[0][1])
    for (let i = 1; i < hole.length; i++) path.lineTo(hole[i][0], hole[i][1])
    shape.holes.push(path)
  }
  return shape
}

function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length < 3) return ring
  const [fx, fy] = ring[0]
  const [lx, ly] = ring[ring.length - 1]
  if (fx !== lx || fy !== ly) ring.push([fx, fy])
  return ring
}

const round3 = (v: number) => Math.round(v * 1000) / 1000
const toRing = (poly: Vector2[]): [number, number][] =>
  closeRing(poly.map((p) => [round3(p.x), round3(p.y)] as [number, number]))

export function outlineTextShapes(
  glyphs: Shape[],
  d: number,
  divisions = 32,
): Shape[] {
  if (d <= 0) return glyphs.map((g) => g.clone() as Shape)
  // Morphological closing: grow every glyph outline by (d + CLOSING), union
  // all of them (adjacent cursive strokes now overlap by 2·CLOSING mm so the
  // union guaranteed-fuses touching or barely-separated glyphs — including
  // i-dots, j-dots, disconnected script swashes), then shrink the merged
  // region back by CLOSING so the plate ends up with an outline of exactly
  // `d` mm around each letter, without any internal seams or side cracks.
  const CLOSING = 2.0
  const growBy = d + CLOSING

  // 1) Grow each glyph outline (drop letter counters).
  const grownRings: [number, number][][][] = []
  for (const g of glyphs) {
    const outerPts = g.getPoints(divisions)
    if (outerPts.length < 3) continue
    const grown = offsetPolygon(outerPts, growBy)
    if (Math.sign(signedArea(outerPts)) !== Math.sign(signedArea(grown))) continue
    grownRings.push([toRing(grown)])
  }
  if (grownRings.length === 0) return []

  // 2) Union everything into one (usually) seamless region.
  const merged = polygonClipping.union(grownRings[0], ...grownRings.slice(1))

  // 3) Shrink each merged polygon back by CLOSING. Holes emerge in the merged
  //    region (letter interiors that survive the grow-union) — they must
  //    shrink AWAY from their center, which offsetPolygon does automatically
  //    since holes are wound CW and negative `d` moves them outward-of-material.
  const shrunkRings: [number, number][][][] = []
  for (const poly of merged) {
    if (poly.length === 0) continue
    const outerVecs = poly[0].slice(0, -1).map(([x, y]) => new Vector2(x, y))
    const shrunkOuter = offsetPolygon(outerVecs, -CLOSING)
    if (shrunkOuter.length < 3) continue
    if (Math.sign(signedArea(outerVecs)) !== Math.sign(signedArea(shrunkOuter))) continue
    const holeRings: [number, number][][] = []
    for (let h = 1; h < poly.length; h++) {
      const holeVecs = poly[h].slice(0, -1).map(([x, y]) => new Vector2(x, y))
      const shrunkHole = offsetPolygon(holeVecs, -CLOSING)
      if (shrunkHole.length < 3) continue
      if (Math.sign(signedArea(holeVecs)) !== Math.sign(signedArea(shrunkHole))) continue
      holeRings.push(toRing(shrunkHole))
    }
    shrunkRings.push([toRing(shrunkOuter), ...holeRings])
  }
  if (shrunkRings.length === 0) return []

  // 4) Final self-union to clean any self-intersections that the negative
  //    offset may have introduced at concave corners — polygon-clipping
  //    normalises the input into non-self-intersecting Simple Features.
  const cleaned = polygonClipping.union(shrunkRings[0], ...shrunkRings.slice(1))

  // 5) Convert back to three.js Shapes.
  const shapes: Shape[] = []
  for (const poly of cleaned) {
    if (poly.length === 0) continue
    const outer = poly[0]
    const holes = poly.slice(1)
    const shape = ringToShape(outer, holes)
    if (shape) shapes.push(shape)
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

import { Path, Shape, Vector2 } from 'three'
import ClipperLib from 'clipper-lib'

// Clipper uses integer coordinates. We work in mm; scale by 1000 → micrometres.
const SCALE = 1000

type CPoint = { X: number; Y: number }
type CPath = CPoint[]
type CPaths = CPath[]

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
 */
export function shiftShape(shape: Shape, dx: number, dy: number): void {
  const dv = new Vector2(dx, dy)
  const shiftCurves = (curves: Shape['curves']) => {
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

function ptsToClipperPath(pts: Vector2[]): CPath | null {
  if (pts.length < 3) return null
  const path: CPath = pts.map((p) => ({
    X: Math.round(p.x * SCALE),
    Y: Math.round(p.y * SCALE),
  }))
  // Clipper handles closed polygons regardless of terminal-vertex duplication,
  // but strips redundant collinear points.
  ClipperLib.JS.Clean(path, 0.5)
  return path
}

function shapeToClipperPath(shape: Shape, divisions: number): CPath | null {
  return ptsToClipperPath(shape.getPoints(divisions))
}

/** Extract every ring in a Shape (outer contour + inner holes / counters) as
 *  Clipper paths, preserving the winding Clipper needs (outer CCW, hole CW). */
function shapeToClipperPathsAll(shape: Shape, divisions: number): CPaths {
  const paths: CPaths = []
  const outer = shapeToClipperPath(shape, divisions)
  if (outer) paths.push(outer)
  for (const hole of shape.holes) {
    const p = ptsToClipperPath(hole.getPoints(divisions))
    if (p) paths.push(p)
  }
  return paths
}

function cpathToShape(path: CPath): Shape | null {
  if (path.length < 3) return null
  const shape = new Shape()
  shape.moveTo(path[0].X / SCALE, path[0].Y / SCALE)
  for (let i = 1; i < path.length; i++) shape.lineTo(path[i].X / SCALE, path[i].Y / SCALE)
  return shape
}

function pathsToShapes(paths: CPaths): Shape[] {
  // Discard any inner-hole rings that Clipper marks with negative orientation;
  // the outline-keychain plate is meant to be solid under each letter.
  const shapes: Shape[] = []
  for (const path of paths) {
    if (!ClipperLib.Clipper.Orientation(path)) continue
    const s = cpathToShape(path)
    if (s) shapes.push(s)
  }
  return shapes
}

/**
 * Convert Clipper paths into three.js Shapes preserving hole topology. Uses
 * Clipper's PolyTree output so each hole gets nested inside the outer contour
 * that contains it — critical for the cavity cutter, where the letter counters
 * ('o', 'e' interiors) must remain as holes so the plate keeps counter pillars.
 */
function pathsToShapesWithHoles(paths: CPaths): Shape[] {
  const shapes: Shape[] = []
  const outers = paths.filter((p) => ClipperLib.Clipper.Orientation(p))
  const holes = paths.filter((p) => !ClipperLib.Clipper.Orientation(p))
  // Assign each hole to the smallest outer contour that contains its first
  // point (handles nested outers correctly).
  const outerArea = new Map<CPath, number>()
  for (const o of outers) outerArea.set(o, Math.abs(ClipperLib.Clipper.Area(o)))
  const outerToHoles = new Map<CPath, CPath[]>()
  for (const o of outers) outerToHoles.set(o, [])
  for (const h of holes) {
    if (h.length < 3) continue
    const p = h[0]
    let best: CPath | null = null
    let bestArea = Infinity
    for (const o of outers) {
      if (ClipperLib.Clipper.PointInPolygon(p, o) !== 0) {
        const a = outerArea.get(o) ?? Infinity
        if (a < bestArea) { bestArea = a; best = o }
      }
    }
    if (best) outerToHoles.get(best)!.push(h)
  }
  for (const o of outers) {
    const s = cpathToShape(o)
    if (!s) continue
    for (const h of outerToHoles.get(o) ?? []) {
      if (h.length < 3) continue
      const path = new Path()
      path.moveTo(h[0].X / SCALE, h[0].Y / SCALE)
      for (let i = 1; i < h.length; i++) path.lineTo(h[i].X / SCALE, h[i].Y / SCALE)
      s.holes.push(path)
    }
    shapes.push(s)
  }
  return shapes
}

function shapesToClipperPaths(shapes: Shape[], divisions: number): CPaths {
  const paths: CPaths = []
  for (const g of shapes) {
    const p = shapeToClipperPath(g, divisions)
    if (p) paths.push(p)
  }
  return paths
}

function clipperUnion(paths: CPaths): CPaths {
  if (paths.length === 0) return []
  if (paths.length === 1) return paths
  const clipper = new ClipperLib.Clipper()
  clipper.AddPaths(paths, ClipperLib.PolyType.ptSubject, true)
  const solution: CPaths = []
  clipper.Execute(
    ClipperLib.ClipType.ctUnion,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  )
  return solution
}

function clipperOffset(paths: CPaths, deltaMm: number): CPaths {
  if (paths.length === 0 || deltaMm === 0) return paths
  const co = new ClipperLib.ClipperOffset(2, 0.25 * SCALE)
  co.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon)
  const solution: CPaths = []
  co.Execute(solution, deltaMm * SCALE)
  return solution
}

/**
 * Merged text silhouette: every glyph outline fused into one seamless region.
 * Uses a small morphological closing (grow by BUFFER → union → shrink by
 * BUFFER) so touching cursive glyphs whose outlines only share an edge fuse
 * into the same polygon. Letter counters ('o', 'e' interiors) are filled —
 * the classic outline-keychain look expects a solid silhouette under each
 * letter.
 *
 * This is the shape that must be used both as the outline base (grown
 * outward for the plate rim) and as the recessed-pocket cutter (at zero
 * offset for a perfectly-fitting seat) so the cavity in the plate is one
 * continuous shape instead of showing internal seams between letters.
 */
export function mergeTextShapes(glyphs: Shape[], divisions = 24): Shape[] {
  const paths = shapesToClipperPaths(glyphs, divisions)
  if (paths.length === 0) return []
  const BUFFER = 1.2
  const grown = clipperOffset(paths, BUFFER)
  const unioned = clipperUnion(grown)
  const shrunk = clipperOffset(unioned, -BUFFER)
  return pathsToShapes(shrunk)
}

/**
 * Same as mergeTextShapes but keeps the letter counters ('o', 'e' interiors)
 * as holes in the resulting Shapes. This is the correct cutter for a recessed
 * embed pocket: subtracting it from the plate produces one continuous cavity
 * around the whole word AND leaves upright pillars where the letter counters
 * are — so the raised text piece drops in flush and the plate keeps the
 * "island" that shows through the 'o'/'e' rings.
 */
export function mergeTextShapesWithCounters(glyphs: Shape[], divisions = 24): Shape[] {
  // Feed every ring of every glyph (outer + counters) into Clipper. Native
  // winding is preserved — outer contours CCW, counter holes CW — which lets
  // Clipper handle the topology correctly with the non-zero fill rule.
  const subjects: CPaths = []
  for (const g of glyphs) subjects.push(...shapeToClipperPathsAll(g, divisions))
  if (subjects.length === 0) return []

  // Direct non-zero union: outer CCW paths add +1 winding, counter CW paths
  // subtract 1. Only regions with nonzero net winding survive → the merged
  // ink region of the whole word, with counters preserved as holes exactly
  // where each glyph put them.
  const clipper = new ClipperLib.Clipper()
  clipper.AddPaths(subjects, ClipperLib.PolyType.ptSubject, true)
  const initial: CPaths = []
  clipper.Execute(
    ClipperLib.ClipType.ctUnion,
    initial,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  )
  if (initial.length === 0) return []

  // Small morphological closing to bridge any hair-thin gaps between cursive
  // glyphs that merely touch instead of overlapping. Applied to BOTH outer
  // contours and hole contours — Clipper's offset respects each ring's
  // winding, so counters shrink then grow back symmetrically (net-neutral).
  const BUFFER = 0.4
  const grown = clipperOffset(initial, BUFFER)
  const grownClipper = new ClipperLib.Clipper()
  grownClipper.AddPaths(grown, ClipperLib.PolyType.ptSubject, true)
  const grownUnion: CPaths = []
  grownClipper.Execute(
    ClipperLib.ClipType.ctUnion,
    grownUnion,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  )
  const closed = clipperOffset(grownUnion, -BUFFER)
  if (closed.length === 0) return pathsToShapesWithHoles(initial)
  return pathsToShapesWithHoles(closed)
}

/**
 * Grow each Shape outline by `d` mm using Clipper — round joins, no spikes,
 * no bumps at concave corners. Also drops letter counters via pathsToShapes.
 * Used to expand the merged text silhouette into the outline plate rim.
 */
export function growShapes(shapes: Shape[], d: number, divisions = 24): Shape[] {
  if (d <= 0) return shapes.map((s) => s.clone() as Shape)
  const paths = shapesToClipperPaths(shapes, divisions)
  const grown = clipperOffset(paths, d)
  return pathsToShapes(grown)
}

/**
 * Grow each Shape (outer contour + holes) by `d` mm, preserving hole
 * topology. Positive `d` grows the outer outward (bigger cavity) and shrinks
 * the holes toward their centre (smaller counter pillars) — exactly the
 * clearance behaviour we need for a snug embed pocket.
 */
export function growShapesWithHoles(shapes: Shape[], d: number, divisions = 24): Shape[] {
  if (d <= 0) return shapes.map((s) => s.clone() as Shape)
  const allPaths: CPaths = []
  for (const s of shapes) allPaths.push(...shapeToClipperPathsAll(s, divisions))
  const grown = clipperOffset(allPaths, d)
  return pathsToShapesWithHoles(grown)
}

/** @deprecated Use mergeTextShapes + growShapes explicitly. Kept for the
 *  old call sites; internally does the same as merge → grow. */
export function outlineTextShapes(
  glyphs: Shape[],
  d: number,
  divisions = 24,
): Shape[] {
  const merged = mergeTextShapes(glyphs, divisions)
  return growShapes(merged, d, divisions)
}

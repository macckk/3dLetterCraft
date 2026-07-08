import { Shape, Vector2 } from 'three'
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

function shapeToClipperPath(shape: Shape, divisions: number): CPath | null {
  const pts = shape.getPoints(divisions)
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

function pathsToShapes(paths: CPaths): Shape[] {
  // Discard any inner-hole rings that Clipper marks with negative orientation;
  // the outline-keychain plate is meant to be solid under each letter.
  const outer = paths.filter((p) => ClipperLib.Clipper.Orientation(p))
  const shapes: Shape[] = []
  for (const path of outer) {
    if (path.length < 3) continue
    const shape = new Shape()
    shape.moveTo(path[0].X / SCALE, path[0].Y / SCALE)
    for (let i = 1; i < path.length; i++) shape.lineTo(path[i].X / SCALE, path[i].Y / SCALE)
    shapes.push(shape)
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

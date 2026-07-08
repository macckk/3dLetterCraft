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

/**
 * Grow each glyph outline by exactly `d` mm using Clipper's polygon offsetter,
 * then union everything into one seamless region, and shrink back the tiny
 * closing buffer used to guarantee the union fuses touching / almost-touching
 * strokes (script swashes, i-dots, disconnected letter parts).
 *
 * Clipper handles the round joins, self-intersections and hole topology
 * correctly — my hand-rolled vertex-bisector offset would produce spikes and
 * bumps at concave corners here.
 */
export function outlineTextShapes(
  glyphs: Shape[],
  d: number,
  divisions = 24,
): Shape[] {
  if (d <= 0) return glyphs.map((g) => g.clone() as Shape)

  // 1) Convert glyphs → Clipper integer paths.
  const paths: CPaths = []
  for (const g of glyphs) {
    const p = shapeToClipperPath(g, divisions)
    if (p) paths.push(p)
  }
  if (paths.length === 0) return []

  // 2) Grow by (d + CLOSING) using round joins so we never introduce spikes.
  //    CLOSING = 1.2 mm — larger than any gap between adjacent cursive glyphs
  //    (i-dot to i-body, script swashes barely touching) so the subsequent
  //    union guaranteed-fuses everything into a single region.
  const CLOSING = 1.2
  const growDelta = (d + CLOSING) * SCALE
  const grownPaths: CPaths = []
  {
    const co = new ClipperLib.ClipperOffset(2, 0.25 * SCALE)
    co.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon)
    co.Execute(grownPaths, growDelta)
  }
  if (grownPaths.length === 0) return []

  // 3) Union all grown paths into one region.
  let unioned: CPaths = grownPaths
  if (grownPaths.length > 1) {
    const clipper = new ClipperLib.Clipper()
    clipper.AddPaths(grownPaths, ClipperLib.PolyType.ptSubject, true)
    const solution: CPaths = []
    clipper.Execute(
      ClipperLib.ClipType.ctUnion,
      solution,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero,
    )
    unioned = solution
  }
  if (unioned.length === 0) return []

  // 4) Shrink by CLOSING so the outline width matches what the user asked for.
  const shrunk: CPaths = []
  {
    const co = new ClipperLib.ClipperOffset(2, 0.25 * SCALE)
    co.AddPaths(unioned, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon)
    co.Execute(shrunk, -CLOSING * SCALE)
  }
  if (shrunk.length === 0) return []

  // 5) Back to three.js Shapes (outer contours only — letter counters stay
  //    filled for the classic outline-keychain look).
  return pathsToShapes(shrunk)
}

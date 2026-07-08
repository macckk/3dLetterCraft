import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg'
import { Matrix4 } from 'three'
import type { BufferGeometry } from 'three'

const evaluator = new Evaluator()

/**
 * Subtract `cutterGeom` (transformed by `cutterMatrix`) from `baseGeom`.
 * Both geometries must be indexed BufferGeometries. Returns a fresh BufferGeometry.
 */
export function subtract(
  baseGeom: BufferGeometry,
  cutterGeom: BufferGeometry,
  cutterMatrix: Matrix4
): BufferGeometry {
  const baseBrush = new Brush(baseGeom)
  baseBrush.updateMatrixWorld()

  const cutterBrush = new Brush(cutterGeom)
  cutterBrush.applyMatrix4(cutterMatrix)
  cutterBrush.updateMatrixWorld()

  const result = evaluator.evaluate(baseBrush, cutterBrush, SUBTRACTION)
  return result.geometry
}

/**
 * Union a set of solids into one clean BufferGeometry — used to fuse the
 * per-glyph outline extrusions of the keychain plate so overlapping strokes
 * become a single seamless solid (no internal walls, no side cracks in the
 * exported STL).
 */
export function unionAll(geoms: BufferGeometry[]): BufferGeometry {
  if (geoms.length === 0) throw new Error('unionAll: empty input')
  if (geoms.length === 1) return geoms[0]
  let acc = new Brush(geoms[0])
  acc.updateMatrixWorld()
  for (let i = 1; i < geoms.length; i++) {
    const b = new Brush(geoms[i])
    b.updateMatrixWorld()
    acc = evaluator.evaluate(acc, b, ADDITION) as Brush
  }
  return acc.geometry
}

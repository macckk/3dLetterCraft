import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
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

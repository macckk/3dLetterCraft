import { ExtrudeGeometry, Shape } from 'three'

/**
 * A box extruded along +Z with rounded XY corners.
 * Centered on origin (X and Y), base at z = 0.
 */
export function roundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  cornerRadius: number,
  curveSegments = 12
): ExtrudeGeometry {
  const r = Math.max(0, Math.min(cornerRadius, width / 2, height / 2))
  const w2 = width / 2
  const h2 = height / 2

  const shape = new Shape()
  if (r <= 0.001) {
    shape.moveTo(-w2, -h2)
    shape.lineTo(w2, -h2)
    shape.lineTo(w2, h2)
    shape.lineTo(-w2, h2)
    shape.lineTo(-w2, -h2)
  } else {
    shape.moveTo(-w2 + r, -h2)
    shape.lineTo(w2 - r, -h2)
    shape.quadraticCurveTo(w2, -h2, w2, -h2 + r)
    shape.lineTo(w2, h2 - r)
    shape.quadraticCurveTo(w2, h2, w2 - r, h2)
    shape.lineTo(-w2 + r, h2)
    shape.quadraticCurveTo(-w2, h2, -w2, h2 - r)
    shape.lineTo(-w2, -h2 + r)
    shape.quadraticCurveTo(-w2, -h2, -w2 + r, -h2)
  }

  const geom = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments,
  })
  return geom
}

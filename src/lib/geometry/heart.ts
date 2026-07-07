import { ExtrudeGeometry, Path, Shape } from 'three'

const SAMPLES = 128

/**
 * A heart-shape plate extruded along +Z, base at z = 0.
 * Centered on X, roughly centered on Y (dip at ~y=+size*0.15).
 * Uses the classic parametric x=16sin^3(t), y=13cos(t)-...
 */
export function heartPlateGeometry(
  size: number,
  thickness: number,
  hole?: { x: number; y: number; radius: number },
  curveSegments = 12
): ExtrudeGeometry {
  const shape = heartShape(size)
  if (hole && hole.radius > 0) {
    const h = new Path()
    // Clockwise for a hole under ExtrudeGeometry rules
    for (let i = SAMPLES; i >= 0; i--) {
      const t = (i / SAMPLES) * Math.PI * 2
      const px = hole.x + hole.radius * Math.cos(t)
      const py = hole.y + hole.radius * Math.sin(t)
      if (i === SAMPLES) h.moveTo(px, py)
      else h.lineTo(px, py)
    }
    shape.holes.push(h)
  }
  return new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments,
  })
}

function heartShape(size: number): Shape {
  const s = new Shape()
  const k = size / 32
  for (let i = 0; i <= SAMPLES; i++) {
    const t = (i / SAMPLES) * Math.PI * 2
    const x = 16 * Math.pow(Math.sin(t), 3)
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    const px = x * k
    const py = y * k
    if (i === 0) s.moveTo(px, py)
    else s.lineTo(px, py)
  }
  return s
}

/** Approximate top-most Y of the heart shape for a given size (lobe peaks). */
export function heartTopY(size: number): number {
  // At t=π/4 (and 7π/4), y ≈ 11.6 in raw parametric coords.
  return (size / 32) * 11.6
}

/**
 * Y of the heart's top-center dip on the interior boundary at x=0.
 * This is where a safely-inside hanging hole must sit BELOW.
 * At t=0 the parametric gives y = 13 - 5 - 2 - 1 = 5.
 */
export function heartDipY(size: number): number {
  return (size / 32) * 5
}

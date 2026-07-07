import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'

/**
 * Extrude a text string using a Three.js Font (loaded via TTFLoader).
 * Result: flat on XY plane, extruded along +Z, centered on origin.
 */
export function extrudeText(
  text: string,
  font: Font,
  opts: { size: number; depth: number; curveSegments?: number }
): TextGeometry {
  const geom = new TextGeometry(text, {
    font,
    size: opts.size,
    depth: opts.depth,
    curveSegments: opts.curveSegments ?? 6,
    bevelEnabled: false,
  })
  geom.computeBoundingBox()
  const bb = geom.boundingBox
  if (bb) {
    const cx = (bb.min.x + bb.max.x) / 2
    const cy = (bb.min.y + bb.max.y) / 2
    geom.translate(-cx, -cy, 0)
  }
  return geom
}

import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import type { Object3D } from 'three'

const exporter = new STLExporter()

export function exportSTL(object: Object3D, filename: string): void {
  // Meshes that were cloned into a fresh Group have stale matrixWorld — force
  // a refresh before parsing so their transforms are applied to the output.
  object.updateMatrixWorld(true)
  const data = exporter.parse(object, { binary: true }) as DataView
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.stl') ? filename : `${filename}.stl`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

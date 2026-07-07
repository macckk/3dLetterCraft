import { BoxGeometry, Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { TemplateDefinition } from './types'
import { TOLERANCE_DEFAULT, TOLERANCE_MAX, TOLERANCE_MIN, TOLERANCE_STEP } from '@/lib/tolerance'
import { loadFont } from '@/lib/fonts/loader'
import { extrudeText } from '@/lib/geometry/text'

const BIG_LETTER_NAMES = new Set(['big-letter', 'stand'])
const SCRIPT_NAMES = new Set(['script-text'])

export const nameWithScriptTemplate: TemplateDefinition = {
  id: 'name-with-script',
  nameKey: 'templates.nameWithScript.name',
  descriptionKey: 'templates.nameWithScript.description',
  controls: [
    { kind: 'text',   id: 'name',           labelKey: 'controls.name',           default: 'Marcelo', maxLength: 24 },
    { kind: 'font',   id: 'bigFont',        labelKey: 'controls.bigFont',        default: 'Playfair Display', category: 'serif' },
    { kind: 'font',   id: 'scriptFont',     labelKey: 'controls.scriptFont',     default: 'Great Vibes',      category: 'script' },
    { kind: 'color',  id: 'bigColor',       labelKey: 'controls.bigColor',       default: '#F5F0E1' },
    { kind: 'color',  id: 'scriptColor',    labelKey: 'controls.scriptColor',    default: '#D62828' },
    { kind: 'number', id: 'bigHeight',      labelKey: 'controls.bigHeight',      default: 120, min: 60,  max: 300, step: 5,   unit: 'mm' },
    { kind: 'number', id: 'baseThickness',  labelKey: 'controls.baseThickness',  default: 15,  min: 6,   max: 40,  step: 1,   unit: 'mm' },
    { kind: 'number', id: 'scriptDepth',    labelKey: 'controls.scriptDepth',    default: 3,   min: 1,   max: 10,  step: 0.5, unit: 'mm' },
    { kind: 'number', id: 'tolerance',      labelKey: 'controls.tolerance',      default: TOLERANCE_DEFAULT, min: TOLERANCE_MIN, max: TOLERANCE_MAX, step: TOLERANCE_STEP, unit: 'mm' },
    { kind: 'toggle', id: 'includeStand',   labelKey: 'controls.includeStand',   default: true },
  ],

  build: async ({ values }) => {
    const name         = String(values.name ?? 'A').trim() || 'A'
    const firstChar    = name.charAt(0).toUpperCase()
    const bigFontName  = String(values.bigFont)
    const scriptFont   = String(values.scriptFont)
    const bigColor     = String(values.bigColor)
    const scriptColor  = String(values.scriptColor)
    const bigHeight    = Number(values.bigHeight)
    const baseThk      = Number(values.baseThickness)
    const scriptDepth  = Number(values.scriptDepth)
    const includeStand = Boolean(values.includeStand)
    // tolerance is stored for future pocket/inlay mode (currently script sits on front face)
    void values.tolerance

    const [bigFont, cursiveFont] = await Promise.all([
      loadFont(bigFontName),
      loadFont(scriptFont),
    ])

    const bigGeom = extrudeText(firstChar, bigFont, {
      size: bigHeight,
      depth: baseThk,
    })
    const scriptGeom = extrudeText(name, cursiveFont, {
      size: bigHeight * 0.42,
      depth: scriptDepth,
    })

    // Bounds after centering (both are centered on XY by extrudeText).
    const bigBounds = new Box3().setFromBufferAttribute(bigGeom.attributes.position as never)
    const scriptBounds = new Box3().setFromBufferAttribute(scriptGeom.attributes.position as never)
    const bigSize = bigBounds.getSize(new Vector3())
    const scriptSize = scriptBounds.getSize(new Vector3())

    const group = new Group()
    group.name = 'name-with-script'

    // Big letter — bottom of extrusion at z = 0 already
    const bigMesh = new Mesh(bigGeom, new MeshStandardMaterial({ color: bigColor, roughness: 0.55 }))
    bigMesh.name = 'big-letter'
    group.add(bigMesh)

    // Script sits on the FRONT face of the big letter (z = baseThk),
    // slightly overlapping so the join looks solid in preview.
    const scriptMesh = new Mesh(scriptGeom, new MeshStandardMaterial({ color: scriptColor, roughness: 0.45 }))
    scriptMesh.name = 'script-text'
    scriptMesh.position.z = baseThk
    group.add(scriptMesh)

    // Stand: a slab under the letter so it can stand upright.
    if (includeStand) {
      const standWidth  = Math.max(bigSize.x, scriptSize.x) * 1.15
      const standThk    = baseThk * 1.3
      const standDepth  = baseThk * 2.6
      const stand = new Mesh(
        new BoxGeometry(standWidth, standThk, standDepth),
        new MeshStandardMaterial({ color: bigColor, roughness: 0.55 })
      )
      // Sit under the letter's bottom (Y-min)
      stand.position.set(0, bigBounds.min.y - standThk / 2, standDepth / 2 - baseThk / 2)
      stand.name = 'stand'
      group.add(stand)
    }

    return group
  },

  getExportables: (group) => {
    const bigParts = new Group()
    const scriptParts = new Group()
    group.traverse((obj) => {
      if (BIG_LETTER_NAMES.has(obj.name)) bigParts.add(obj.clone())
      if (SCRIPT_NAMES.has(obj.name)) scriptParts.add(obj.clone())
    })
    return [
      { label: 'big',    color: '#F5F0E1', object: bigParts },
      { label: 'script', color: '#D62828', object: scriptParts },
    ]
  },
}

import { BoxGeometry, Box3, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { BufferGeometry } from 'three'
import type { TemplateDefinition } from './types'
import { TOLERANCE_DEFAULT, TOLERANCE_MAX, TOLERANCE_MIN, TOLERANCE_STEP } from '@/lib/tolerance'
import { loadFont } from '@/lib/fonts/loader'
import { extrudeText } from '@/lib/geometry/text'
import { subtract } from '@/lib/geometry/csg'

const OVERLAP = 0.4  // small overlap for coplanar-face z-fight avoidance
const CUTTER_OVERSHOOT = 1.0  // cutter sticks out past letter's front face to guarantee a clean cut

const BIG_LETTER_NAMES = new Set(['big-letter', 'stand'])
const SCRIPT_NAMES = new Set(['script-text'])

export const nameWithScriptTemplate: TemplateDefinition = {
  id: 'name-with-script',
  nameKey: 'templates.nameWithScript.name',
  descriptionKey: 'templates.nameWithScript.description',
  controls: [
    { kind: 'text',   id: 'name',           labelKey: 'controls.name',           default: 'Marcelo', maxLength: 24 },
    { kind: 'font',   id: 'bigFont',        labelKey: 'controls.bigFont',        default: 'Cardo',      category: 'serif' },
    { kind: 'font',   id: 'scriptFont',     labelKey: 'controls.scriptFont',     default: 'Sacramento', category: 'script' },
    { kind: 'color',  id: 'bigColor',       labelKey: 'controls.bigColor',       default: '#F5F0E1' },
    { kind: 'color',  id: 'scriptColor',    labelKey: 'controls.scriptColor',    default: '#D62828' },
    { kind: 'number', id: 'bigHeight',      labelKey: 'controls.bigHeight',      default: 120, min: 60,  max: 300, step: 5,   unit: 'mm' },
    { kind: 'number', id: 'baseThickness',  labelKey: 'controls.baseThickness',  default: 15,  min: 6,   max: 40,  step: 1,   unit: 'mm' },
    { kind: 'number', id: 'scriptDepth',    labelKey: 'controls.scriptDepth',    default: 3,   min: 1,   max: 10,  step: 0.5, unit: 'mm' },
    { kind: 'number', id: 'tolerance',      labelKey: 'controls.tolerance',      default: TOLERANCE_DEFAULT, min: TOLERANCE_MIN, max: TOLERANCE_MAX, step: TOLERANCE_STEP, unit: 'mm' },
    { kind: 'toggle', id: 'includeStand',   labelKey: 'controls.includeStand',   default: true },
  ],

  build: async ({ values, mode }) => {
    const name         = String(values.name ?? 'A').trim() || 'A'
    const firstChar    = name.charAt(0).toUpperCase()
    const bigFontName  = String(values.bigFont)
    const scriptFontName = String(values.scriptFont)
    const bigColor     = String(values.bigColor)
    const scriptColor  = String(values.scriptColor)
    const bigHeight    = Number(values.bigHeight)
    const baseThk      = Number(values.baseThickness)
    const scriptDepth  = Number(values.scriptDepth)
    const tolerance    = Number(values.tolerance)
    const includeStand = Boolean(values.includeStand)

    const [bigFont, cursiveFont] = await Promise.all([
      loadFont(bigFontName),
      loadFont(scriptFontName),
    ])

    const scriptSize = bigHeight * 0.42

    // Big letter (extruded z: 0 → baseThk)
    const bigGeom = extrudeText(firstChar, bigFont, { size: bigHeight, depth: baseThk })

    // Script insert (natural size)
    const scriptGeom = extrudeText(name, cursiveFont, { size: scriptSize, depth: scriptDepth })

    // CSG (pocket) only in export mode — it's expensive and would freeze the UI
    // on every slider change. In preview we stack the script on the front face
    // (see script positioning below) so the user still sees the visual composition.
    let bigWithPocket: BufferGeometry = bigGeom
    if (mode === 'export') {
      const cutterGeom = extrudeText(name, cursiveFont, {
        size: scriptSize,
        depth: scriptDepth + CUTTER_OVERSHOOT,
        curveSegments: 4,
      })
      if (tolerance > 0) {
        const cutterBounds = new Box3().setFromBufferAttribute(cutterGeom.attributes.position as never)
        const cutterSize = cutterBounds.getSize(new Vector3())
        const avgHalfExtent = (cutterSize.x + cutterSize.y) / 4
        const scaleXY = 1 + tolerance / Math.max(avgHalfExtent, 1)
        cutterGeom.scale(scaleXY, scaleXY, 1)
      }
      const cutterMatrix = new Matrix4().makeTranslation(0, 0, baseThk - scriptDepth)
      bigWithPocket = subtract(bigGeom, cutterGeom, cutterMatrix)
      bigGeom.dispose()
      cutterGeom.dispose()
    }

    // Bounds for placement/sizing
    const bigBounds = new Box3().setFromBufferAttribute(bigWithPocket.attributes.position as never)
    const scriptBounds = new Box3().setFromBufferAttribute(scriptGeom.attributes.position as never)
    const bigSize = bigBounds.getSize(new Vector3())
    const scriptSizeVec = scriptBounds.getSize(new Vector3())

    const group = new Group()
    group.name = 'name-with-script'

    // Big letter with pocket
    const bigMesh = new Mesh(bigWithPocket, new MeshStandardMaterial({ color: bigColor, roughness: 0.55 }))
    bigMesh.name = 'big-letter'
    bigMesh.castShadow = true
    bigMesh.receiveShadow = true
    group.add(bigMesh)

    // Script placement:
    //   • export: seated in the CSG pocket, flush with front face.
    //   • preview: stacked slightly into the front face for a solid look
    //     (no CSG, so no real pocket).
    const scriptMesh = new Mesh(scriptGeom, new MeshStandardMaterial({ color: scriptColor, roughness: 0.45 }))
    scriptMesh.name = 'script-text'
    scriptMesh.position.z = mode === 'export' ? baseThk - scriptDepth : baseThk - OVERLAP
    scriptMesh.castShadow = true
    group.add(scriptMesh)

    // Stand — back face aligned with letter's back face (both at z = 0),
    // extending FORWARD (+Z) only. Sits under letter (Y-min).
    if (includeStand) {
      const standWidth  = Math.max(bigSize.x, scriptSizeVec.x) * 1.15
      const standThk    = baseThk * 1.3
      const standDepth  = baseThk * 2.6
      const stand = new Mesh(
        new BoxGeometry(standWidth, standThk, standDepth),
        new MeshStandardMaterial({ color: bigColor, roughness: 0.55 })
      )
      stand.position.set(
        0,
        bigBounds.min.y - standThk / 2 + OVERLAP,
        standDepth / 2  // back at z = 0, front at z = standDepth
      )
      stand.name = 'stand'
      stand.castShadow = true
      stand.receiveShadow = true
      group.add(stand)
    }

    // Lift the whole assembly so its bottom sits on y = 0.
    const overall = new Box3().setFromObject(group)
    group.position.y = -overall.min.y

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

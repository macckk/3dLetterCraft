import { BoxGeometry, Box3, Group, Matrix4, Mesh, MeshStandardMaterial } from 'three'
import type { BufferGeometry } from 'three'
import type { TemplateDefinition } from './types'
import { TOLERANCE_DEFAULT, TOLERANCE_MAX, TOLERANCE_MIN, TOLERANCE_STEP } from '@/lib/tolerance'
import { loadFont } from '@/lib/fonts/loader'
import { extrudeText } from '@/lib/geometry/text'
import { subtract } from '@/lib/geometry/csg'

const OVERLAP = 0.4
const CUTTER_OVERSHOOT = 1.0

const BIG_LETTER_NAMES = new Set(['big-letter', 'stand'])
const SCRIPT_NAMES = new Set(['script-text'])

export const nameWithScriptTemplate: TemplateDefinition = {
  id: 'name-with-script',
  nameKey: 'templates.nameWithScript.name',
  descriptionKey: 'templates.nameWithScript.description',
  controls: [
    { kind: 'text',   id: 'name',            labelKey: 'controls.name',            default: 'Marcelo', maxLength: 24 },
    { kind: 'font',   id: 'bigFont',         labelKey: 'controls.bigFont',         default: 'Cardo',      category: 'serif' },
    { kind: 'font',   id: 'scriptFont',      labelKey: 'controls.scriptFont',      default: 'Sacramento', category: 'script' },
    { kind: 'color',  id: 'bigColor',        labelKey: 'controls.bigColor',        default: '#F5F0E1' },
    { kind: 'color',  id: 'scriptColor',     labelKey: 'controls.scriptColor',     default: '#D62828' },

    // Big letter
    { kind: 'number', id: 'bigHeight',       labelKey: 'controls.bigHeight',       default: 120, min: 60,  max: 300, step: 5,   unit: 'mm' },
    { kind: 'number', id: 'letterThickness', labelKey: 'controls.letterThickness', default: 15,  min: 6,   max: 40,  step: 1,   unit: 'mm' },

    // Script
    { kind: 'number', id: 'scriptHeight',    labelKey: 'controls.scriptHeight',    default: 50,  min: 10,  max: 200, step: 1,   unit: 'mm' },
    { kind: 'number', id: 'scriptYOffset',   labelKey: 'controls.scriptYOffset',   default: 0,   min: -100,max: 100, step: 1,   unit: 'mm' },
    { kind: 'number', id: 'scriptInset',     labelKey: 'controls.scriptInset',     default: 2,   min: 0,   max: 20,  step: 0.5, unit: 'mm' },
    { kind: 'number', id: 'scriptRelief',    labelKey: 'controls.scriptRelief',    default: 1.5, min: 0,   max: 10,  step: 0.5, unit: 'mm' },
    { kind: 'number', id: 'tolerance',       labelKey: 'controls.tolerance',       default: TOLERANCE_DEFAULT, min: TOLERANCE_MIN, max: TOLERANCE_MAX, step: TOLERANCE_STEP, unit: 'mm' },

    // Base
    { kind: 'toggle', id: 'includeStand',    labelKey: 'controls.includeStand',    default: true },
    { kind: 'number', id: 'baseWidth',       labelKey: 'controls.baseWidth',       default: 130, min: 30,  max: 400, step: 5,   unit: 'mm' },
    { kind: 'number', id: 'baseHeight',      labelKey: 'controls.baseHeight',      default: 18,  min: 5,   max: 60,  step: 1,   unit: 'mm' },
    { kind: 'number', id: 'baseDepth',       labelKey: 'controls.baseDepth',       default: 45,  min: 15,  max: 150, step: 5,   unit: 'mm' },
  ],

  build: async ({ values, mode }) => {
    const name           = String(values.name ?? 'A').trim() || 'A'
    const firstChar      = name.charAt(0).toUpperCase()
    const bigFontName    = String(values.bigFont)
    const scriptFontName = String(values.scriptFont)
    const bigColor       = String(values.bigColor)
    const scriptColor    = String(values.scriptColor)
    const bigHeight      = Number(values.bigHeight)
    const letterThk      = Number(values.letterThickness)
    const scriptHeight   = Number(values.scriptHeight)
    const scriptYOffset  = Number(values.scriptYOffset)
    const scriptInset    = Number(values.scriptInset)
    const scriptRelief   = Number(values.scriptRelief)
    const tolerance      = Number(values.tolerance)
    const includeStand   = Boolean(values.includeStand)
    const baseWidth      = Number(values.baseWidth)
    const baseHeight     = Number(values.baseHeight)
    const baseDepth      = Number(values.baseDepth)

    const [bigFont, cursiveFont] = await Promise.all([
      loadFont(bigFontName),
      loadFont(scriptFontName),
    ])

    // Big letter — extruded z: 0 → letterThk
    const bigGeom = extrudeText(firstChar, bigFont, { size: bigHeight, depth: letterThk })

    // Script insert — thickness = inset (inside pocket) + relief (protruding)
    const totalScriptDepth = Math.max(0.1, scriptInset + scriptRelief)
    const scriptGeom = extrudeText(name, cursiveFont, { size: scriptHeight, depth: totalScriptDepth })

    // CSG pocket — only in export mode, only when there's actual inset to carve
    let bigWithPocket: BufferGeometry = bigGeom
    if (mode === 'export' && scriptInset > 0) {
      const cutterGeom = extrudeText(name, cursiveFont, {
        size: scriptHeight,
        depth: scriptInset + CUTTER_OVERSHOOT,
        curveSegments: 4,
      })
      if (tolerance > 0) {
        const cb = new Box3().setFromBufferAttribute(cutterGeom.attributes.position as never)
        const avgHalfExtent = (cb.max.x - cb.min.x + cb.max.y - cb.min.y) / 4
        const scaleXY = 1 + tolerance / Math.max(avgHalfExtent, 1)
        cutterGeom.scale(scaleXY, scaleXY, 1)
      }
      const cutterMatrix = new Matrix4().makeTranslation(
        0,
        scriptYOffset,
        letterThk - scriptInset
      )
      bigWithPocket = subtract(bigGeom, cutterGeom, cutterMatrix)
      bigGeom.dispose()
      cutterGeom.dispose()
    }

    const bigBounds = new Box3().setFromBufferAttribute(bigWithPocket.attributes.position as never)

    const group = new Group()
    group.name = 'name-with-script'

    // Big letter
    const bigMesh = new Mesh(bigWithPocket, new MeshStandardMaterial({ color: bigColor, roughness: 0.55 }))
    bigMesh.name = 'big-letter'
    bigMesh.castShadow = true
    bigMesh.receiveShadow = true
    group.add(bigMesh)

    // Script placement:
    //   • back face at z = letterThk − scriptInset (pocket floor / letter front)
    //   • front face at z = letterThk + scriptRelief  (protruding by relief amount)
    //   • when scriptInset = 0 in preview, nudge slightly into the letter to avoid z-fight
    const scriptZ = mode === 'preview' && scriptInset === 0
      ? letterThk - OVERLAP
      : letterThk - scriptInset
    const scriptMesh = new Mesh(scriptGeom, new MeshStandardMaterial({ color: scriptColor, roughness: 0.45 }))
    scriptMesh.name = 'script-text'
    scriptMesh.position.set(0, scriptYOffset, scriptZ)
    scriptMesh.castShadow = true
    group.add(scriptMesh)

    // Base plate — back face aligned with letter's back face (z = 0), extends forward.
    if (includeStand) {
      const base = new Mesh(
        new BoxGeometry(baseWidth, baseHeight, baseDepth),
        new MeshStandardMaterial({ color: bigColor, roughness: 0.55 })
      )
      base.position.set(
        0,
        bigBounds.min.y - baseHeight / 2 + OVERLAP,
        baseDepth / 2
      )
      base.name = 'stand'
      base.castShadow = true
      base.receiveShadow = true
      group.add(base)
    }

    // Lift assembly so bottom sits on y = 0
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

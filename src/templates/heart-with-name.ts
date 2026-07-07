import { Box3, Group, Matrix4, Mesh, MeshStandardMaterial } from 'three'
import type { BufferGeometry } from 'three'
import type { ControlValues, TemplateDefinition, ValidationIssue } from './types'
import { TOLERANCE_DEFAULT, TOLERANCE_MAX, TOLERANCE_MIN, TOLERANCE_STEP } from '@/lib/tolerance'
import { loadFont } from '@/lib/fonts/loader'
import { extrudeText } from '@/lib/geometry/text'
import { heartPlateGeometry, heartTopY } from '@/lib/geometry/heart'
import { subtract } from '@/lib/geometry/csg'

const OVERLAP = 0.4
const CUTTER_OVERSHOOT = 1.0
const CURVE_SEGMENTS_VISIBLE = 24
const CURVE_SEGMENTS_CUTTER = 12

const whenHole = (v: ControlValues) => v.includeHole === true

export const heartWithNameTemplate: TemplateDefinition = {
  id: 'heart-with-name',
  nameKey: 'templates.heartWithName.name',
  descriptionKey: 'templates.heartWithName.description',
  controls: [
    { kind: 'text',  id: 'name',        labelKey: 'controls.name',       default: 'amor', maxLength: 20 },
    { kind: 'font',  id: 'scriptFont',  labelKey: 'controls.scriptFont', default: 'Sacramento', category: 'script' },
    { kind: 'color', id: 'heartColor',  labelKey: 'controls.heartColor',  default: '#D62828' },
    { kind: 'color', id: 'scriptColor', labelKey: 'controls.scriptColor', default: '#F5F0E1' },

    { kind: 'number', id: 'heartSize',      labelKey: 'controls.heartSize',      default: 100, min: 40, max: 250, step: 5,   unit: 'mm' },
    { kind: 'number', id: 'heartThickness', labelKey: 'controls.heartThickness', default: 6,   min: 3,  max: 20,  step: 0.5, unit: 'mm' },

    { kind: 'number', id: 'scriptHeight', labelKey: 'controls.scriptHeight', default: 30,  min: 10,  max: 120, step: 1,   unit: 'mm' },
    { kind: 'number', id: 'scriptInset',  labelKey: 'controls.scriptInset',  default: 1.5, min: 0,   max: 10,  step: 0.5, unit: 'mm' },
    { kind: 'number', id: 'scriptRelief', labelKey: 'controls.scriptRelief', default: 1.5, min: 0,   max: 8,   step: 0.5, unit: 'mm' },
    { kind: 'number', id: 'tolerance',    labelKey: 'controls.tolerance',    default: TOLERANCE_DEFAULT, min: TOLERANCE_MIN, max: TOLERANCE_MAX, step: TOLERANCE_STEP, unit: 'mm' },

    { kind: 'toggle', id: 'includeHole',   labelKey: 'controls.includeHole',   default: true },
    { kind: 'number', id: 'holeDiameter',  labelKey: 'controls.holeDiameter',  default: 5, min: 2,  max: 15, step: 0.5, unit: 'mm', visibleWhen: whenHole },
    { kind: 'number', id: 'holeMargin',    labelKey: 'controls.holeMargin',    default: 6, min: 2,  max: 30, step: 0.5, unit: 'mm', visibleWhen: whenHole },
  ],

  presets: [
    { id: 'red',    nameKey: 'templates.heartWithName.presets.red',    values: { heartColor: '#D62828', scriptColor: '#F5F0E1', scriptFont: 'Sacramento' } },
    { id: 'pastel', nameKey: 'templates.heartWithName.presets.pastel', values: { heartColor: '#F7B6C2', scriptColor: '#B25668', scriptFont: 'Allura' } },
    { id: 'gold',   nameKey: 'templates.heartWithName.presets.gold',   values: { heartColor: '#111111', scriptColor: '#E5B84B', scriptFont: 'Pacifico' } },
  ],

  validate: (values: ControlValues): ValidationIssue[] => {
    const issues: ValidationIssue[] = []
    const heartThk    = Number(values.heartThickness)
    const scriptInset = Number(values.scriptInset)
    const scriptRelief= Number(values.scriptRelief)
    const tolerance   = Number(values.tolerance)
    const scriptHeight= Number(values.scriptHeight)
    const heartSize   = Number(values.heartSize)
    if (scriptRelief > 0 && scriptRelief < 0.8) {
      issues.push({ severity: 'warning', messageKey: 'validation.scriptReliefThin', params: { min: 0.8, value: scriptRelief } })
    }
    if (heartThk < 3) {
      issues.push({ severity: 'warning', messageKey: 'validation.letterThin', params: { min: 3, value: heartThk } })
    }
    if (tolerance === 0 && scriptInset > 0) {
      issues.push({ severity: 'warning', messageKey: 'validation.zeroTolerance' })
    }
    if (scriptInset > heartThk / 2) {
      issues.push({ severity: 'warning', messageKey: 'validation.pocketTooDeep', params: { letterThk: heartThk } })
    }
    if (scriptHeight > heartSize * 0.5) {
      issues.push({ severity: 'warning', messageKey: 'validation.scriptTooTall' })
    }
    return issues
  },

  build: async ({ values, mode }) => {
    const name         = String(values.name ?? 'amor').trim() || 'amor'
    const scriptFontName = String(values.scriptFont)
    const heartColor   = String(values.heartColor)
    const scriptColor  = String(values.scriptColor)
    const heartSize    = Number(values.heartSize)
    const heartThk     = Number(values.heartThickness)
    const scriptHeight = Number(values.scriptHeight)
    const scriptInset  = Number(values.scriptInset)
    const scriptRelief = Number(values.scriptRelief)
    const tolerance    = Number(values.tolerance)
    const includeHole  = Boolean(values.includeHole)
    const holeDiameter = Number(values.holeDiameter)
    const holeMargin   = Number(values.holeMargin)

    const scriptFont = await loadFont(scriptFontName)

    let holeSpec: { x: number; y: number; radius: number } | undefined
    if (includeHole) {
      const topY = heartTopY(heartSize)
      // Put hole near the top-center dip
      const hy = topY - holeMargin - holeDiameter / 2
      holeSpec = { x: 0, y: hy, radius: holeDiameter / 2 }
    }

    let heartGeom: BufferGeometry = heartPlateGeometry(heartSize, heartThk, holeSpec, CURVE_SEGMENTS_VISIBLE)

    // Script text
    const totalScriptDepth = Math.max(0.1, scriptInset + scriptRelief)
    const scriptGeom = extrudeText(name, scriptFont, {
      size: scriptHeight,
      depth: totalScriptDepth,
      curveSegments: CURVE_SEGMENTS_VISIBLE,
    })

    // Pocket in heart (export only)
    if (mode === 'export' && scriptInset > 0) {
      const cutterGeom = extrudeText(name, scriptFont, {
        size: scriptHeight,
        depth: scriptInset + CUTTER_OVERSHOOT,
        curveSegments: CURVE_SEGMENTS_CUTTER,
      })
      if (tolerance > 0) {
        const cb = new Box3().setFromBufferAttribute(cutterGeom.attributes.position as never)
        const avgHalfExtent = (cb.max.x - cb.min.x + cb.max.y - cb.min.y) / 4
        const scaleXY = 1 + tolerance / Math.max(avgHalfExtent, 1)
        cutterGeom.scale(scaleXY, scaleXY, 1)
      }
      const cutterMatrix = new Matrix4().makeTranslation(0, 0, heartThk - scriptInset)
      heartGeom = subtract(heartGeom, cutterGeom, cutterMatrix)
      cutterGeom.dispose()
    }

    const group = new Group()
    group.name = 'heart-with-name'

    const heartMesh = new Mesh(heartGeom, new MeshStandardMaterial({ color: heartColor, roughness: 0.55 }))
    heartMesh.name = 'heart'
    heartMesh.castShadow = true
    heartMesh.receiveShadow = true
    group.add(heartMesh)

    const scriptZ = mode === 'preview' && scriptInset === 0
      ? heartThk - OVERLAP
      : heartThk - scriptInset
    const scriptMesh = new Mesh(scriptGeom, new MeshStandardMaterial({ color: scriptColor, roughness: 0.45 }))
    scriptMesh.name = 'script-text'
    scriptMesh.position.set(0, 0, scriptZ)
    scriptMesh.castShadow = true
    group.add(scriptMesh)

    // Lift so bottom sits on y = 0
    const overall = new Box3().setFromObject(group)
    group.position.y = -overall.min.y
    return group
  },

  getExportables: (group) => {
    const heartParts = new Group()
    const scriptParts = new Group()
    group.traverse((obj) => {
      if (obj.name === 'heart') heartParts.add(obj.clone())
      if (obj.name === 'script-text') scriptParts.add(obj.clone())
    })
    return [
      { label: 'heart',  color: '#D62828', object: heartParts },
      { label: 'script', color: '#F5F0E1', object: scriptParts },
    ]
  },
}

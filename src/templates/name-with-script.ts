import { Box3, Group, Matrix4, Mesh, MeshStandardMaterial } from 'three'
import type { BufferGeometry } from 'three'
import type { ControlValues, TemplateDefinition, ValidationIssue } from './types'
import { TOLERANCE_DEFAULT, TOLERANCE_MAX, TOLERANCE_MIN, TOLERANCE_STEP } from '@/lib/tolerance'
import { loadFont } from '@/lib/fonts/loader'
import { extrudeText } from '@/lib/geometry/text'
import { roundedBoxGeometry } from '@/lib/geometry/box'
import { subtract } from '@/lib/geometry/csg'

const OVERLAP = 0.4
const CUTTER_OVERSHOOT = 1.0

// Curve resolution — higher = smoother printed surface, more polys.
// Keep the cutter LOWER than the visible parts so CSG stays snappy.
const CURVE_SEGMENTS_VISIBLE = 16
const CURVE_SEGMENTS_CUTTER = 8

const BIG_LETTER_NAMES = new Set(['big-letter', 'stand'])
const SCRIPT_NAMES = new Set(['script-text'])

const whenBase = (v: ControlValues) => v.includeStand === true

export const nameWithScriptTemplate: TemplateDefinition = {
  id: 'name-with-script',
  nameKey: 'templates.nameWithScript.name',
  descriptionKey: 'templates.nameWithScript.description',
  controls: [
    { kind: 'text',   id: 'name',            labelKey: 'controls.name',            default: 'Marcelo', maxLength: 24 },
    { kind: 'font',   id: 'bigFont',         labelKey: 'controls.bigFont',         default: 'Cardo',      category: 'block' },
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

    // Base — the rest of the base controls only show when includeStand is true
    { kind: 'toggle', id: 'includeStand',      labelKey: 'controls.includeStand',      default: true },
    { kind: 'number', id: 'baseWidth',         labelKey: 'controls.baseWidth',         default: 130, min: 30, max: 400, step: 5,   unit: 'mm', visibleWhen: whenBase },
    { kind: 'number', id: 'baseHeight',        labelKey: 'controls.baseHeight',        default: 18,  min: 5,  max: 60,  step: 1,   unit: 'mm', visibleWhen: whenBase },
    { kind: 'number', id: 'baseDepth',         labelKey: 'controls.baseDepth',         default: 45,  min: 15, max: 150, step: 5,   unit: 'mm', visibleWhen: whenBase },
    { kind: 'number', id: 'baseCornerRadius',  labelKey: 'controls.baseCornerRadius',  default: 3,   min: 0,  max: 30,  step: 0.5, unit: 'mm', visibleWhen: whenBase },
    { kind: 'number', id: 'letterEmbed',       labelKey: 'controls.letterEmbed',       default: 3,   min: 0,  max: 15,  step: 0.5, unit: 'mm', visibleWhen: whenBase },
  ],

  presets: [
    {
      id: 'classic',
      nameKey: 'templates.nameWithScript.presets.classic',
      values: {
        bigFont: 'Cardo',        scriptFont: 'Sacramento',
        bigColor: '#F5F0E1',     scriptColor: '#D62828',
        bigHeight: 120,          letterThickness: 15,
        scriptHeight: 50,        scriptInset: 2, scriptRelief: 1.5,
      },
    },
    {
      id: 'romantic',
      nameKey: 'templates.nameWithScript.presets.romantic',
      values: {
        bigFont: 'EB Garamond',  scriptFont: 'Allura',
        bigColor: '#F7E7E1',     scriptColor: '#B25668',
        bigHeight: 130,          letterThickness: 14,
        scriptHeight: 55,        scriptInset: 2, scriptRelief: 1.5,
      },
    },
    {
      id: 'modern',
      nameKey: 'templates.nameWithScript.presets.modern',
      values: {
        bigFont: 'Bebas Neue',   scriptFont: 'Pacifico',
        bigColor: '#111111',     scriptColor: '#E5B84B',
        bigHeight: 140,          letterThickness: 18,
        scriptHeight: 48,        scriptInset: 2.5, scriptRelief: 1.8,
      },
    },
  ],

  validate: (values: ControlValues): ValidationIssue[] => {
    const issues: ValidationIssue[] = []
    const letterThk    = Number(values.letterThickness)
    const scriptRelief = Number(values.scriptRelief)
    const scriptInset  = Number(values.scriptInset)
    const scriptHeight = Number(values.scriptHeight)
    const bigHeight    = Number(values.bigHeight)
    const tolerance    = Number(values.tolerance)
    const includeStand = Boolean(values.includeStand)
    const baseHeight   = Number(values.baseHeight)
    const letterEmbed  = Number(values.letterEmbed ?? 0)

    // Wall/feature strength (~0.8mm = 2 perimeters at 0.4mm nozzle)
    if (scriptRelief > 0 && scriptRelief < 0.8) {
      issues.push({ severity: 'warning', messageKey: 'validation.scriptReliefThin', params: { min: 0.8, value: scriptRelief } })
    }
    if (letterThk < 2) {
      issues.push({ severity: 'warning', messageKey: 'validation.letterThin', params: { min: 2, value: letterThk } })
    }
    // Fit clearance vs. inset/embed
    if (tolerance === 0 && (scriptInset > 0 || letterEmbed > 0)) {
      issues.push({ severity: 'warning', messageKey: 'validation.zeroTolerance' })
    }
    // Pocket vs. wall proportions
    if (scriptInset > letterThk / 2) {
      issues.push({ severity: 'warning', messageKey: 'validation.pocketTooDeep', params: { letterThk } })
    }
    // Script vertical fit inside the big letter
    if (scriptHeight > bigHeight * 0.85) {
      issues.push({ severity: 'warning', messageKey: 'validation.scriptTooTall' })
    }
    // Base can host the embed
    if (includeStand && letterEmbed > 0 && baseHeight < letterEmbed + 3) {
      issues.push({ severity: 'warning', messageKey: 'validation.baseTooThin', params: { min: letterEmbed + 3 } })
    }
    return issues
  },

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
    const baseCornerR    = Number(values.baseCornerRadius)
    const letterEmbed    = Number(values.letterEmbed ?? 0)

    const [bigFont, cursiveFont] = await Promise.all([
      loadFont(bigFontName),
      loadFont(scriptFontName),
    ])

    // Big letter (z: 0 → letterThk)
    const bigGeom = extrudeText(firstChar, bigFont, {
      size: bigHeight,
      depth: letterThk,
      curveSegments: CURVE_SEGMENTS_VISIBLE,
    })

    // Script insert (thickness = inset + relief)
    const totalScriptDepth = Math.max(0.1, scriptInset + scriptRelief)
    const scriptGeom = extrudeText(name, cursiveFont, {
      size: scriptHeight,
      depth: totalScriptDepth,
      curveSegments: CURVE_SEGMENTS_VISIBLE,
    })

    // CSG pocket in export mode when there's actual inset
    let bigWithPocket: BufferGeometry = bigGeom
    if (mode === 'export' && scriptInset > 0) {
      const cutterGeom = extrudeText(name, cursiveFont, {
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
      const cutterMatrix = new Matrix4().makeTranslation(0, scriptYOffset, letterThk - scriptInset)
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

    // Script
    const scriptZ = mode === 'preview' && scriptInset === 0
      ? letterThk - OVERLAP
      : letterThk - scriptInset
    const scriptMesh = new Mesh(scriptGeom, new MeshStandardMaterial({ color: scriptColor, roughness: 0.45 }))
    scriptMesh.name = 'script-text'
    scriptMesh.position.set(0, scriptYOffset, scriptZ)
    scriptMesh.castShadow = true
    group.add(scriptMesh)

    // Base — rounded box, back face at z = 0, extending forward
    if (includeStand) {
      let baseGeom: BufferGeometry = roundedBoxGeometry(baseWidth, baseHeight, baseDepth, baseCornerR, CURVE_SEGMENTS_VISIBLE)
      // Positive letterEmbed sinks the letter into the base by that many mm;
      // 0 falls back to a tiny OVERLAP so the preview has no z-fighting seam.
      const embed = letterEmbed > 0 ? letterEmbed : OVERLAP
      const baseY = bigBounds.min.y - baseHeight / 2 + embed

      // Carve a slot in the base matching the letter footprint (export only).
      if (mode === 'export' && letterEmbed > 0) {
        const baseCutter = extrudeText(firstChar, bigFont, {
          size: bigHeight,
          depth: letterThk,
          curveSegments: CURVE_SEGMENTS_CUTTER,
        })
        if (tolerance > 0) {
          const cb = new Box3().setFromBufferAttribute(baseCutter.attributes.position as never)
          const avgHalfExtent = (cb.max.x - cb.min.x + cb.max.y - cb.min.y) / 4
          const scaleXY = 1 + tolerance / Math.max(avgHalfExtent, 1)
          baseCutter.scale(scaleXY, scaleXY, 1)
        }
        // Letter sits at world (0, 0, 0). Base local origin is at world (0, baseY, 0).
        const cutterMatrix = new Matrix4().makeTranslation(0, -baseY, 0)
        baseGeom = subtract(baseGeom, baseCutter, cutterMatrix)
        baseCutter.dispose()
      }

      const base = new Mesh(baseGeom, new MeshStandardMaterial({ color: bigColor, roughness: 0.55 }))
      base.position.set(0, baseY, 0)
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

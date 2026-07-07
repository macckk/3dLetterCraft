import { Box3, Group, Matrix4, Mesh, MeshStandardMaterial } from 'three'
import type { BufferGeometry } from 'three'
import type { ControlValues, TemplateDefinition, ValidationIssue } from './types'
import { TOLERANCE_DEFAULT, TOLERANCE_MAX, TOLERANCE_MIN, TOLERANCE_STEP } from '@/lib/tolerance'
import { loadFont } from '@/lib/fonts/loader'
import { extrudeText } from '@/lib/geometry/text'
import { roundedBoxGeometry } from '@/lib/geometry/box'
import { subtract } from '@/lib/geometry/csg'

const OVERLAP = 0.4
const CURVE_SEGMENTS_VISIBLE = 16
const CURVE_SEGMENTS_CUTTER = 8

const whenBase = (v: ControlValues) => v.includeStand === true

function xExtent(geom: BufferGeometry): number {
  const bb = new Box3().setFromBufferAttribute(geom.attributes.position as never)
  return bb.max.x - bb.min.x
}

export const coupleInitialsTemplate: TemplateDefinition = {
  id: 'couple-initials',
  nameKey: 'templates.coupleInitials.name',
  descriptionKey: 'templates.coupleInitials.description',
  controls: [
    { kind: 'text',  id: 'initial1',      labelKey: 'controls.initial1',  default: 'M', maxLength: 2 },
    { kind: 'text',  id: 'separator',     labelKey: 'controls.separator', default: '&', maxLength: 2 },
    { kind: 'text',  id: 'initial2',      labelKey: 'controls.initial2',  default: 'J', maxLength: 2 },
    { kind: 'font',  id: 'font',          labelKey: 'controls.font',      default: 'Cardo', category: 'block' },
    { kind: 'color', id: 'letterColor',   labelKey: 'controls.letterColor',    default: '#F5F0E1' },
    { kind: 'color', id: 'separatorColor',labelKey: 'controls.separatorColor', default: '#D62828' },

    { kind: 'number', id: 'letterHeight',    labelKey: 'controls.letterHeight',    default: 100, min: 40, max: 250, step: 5,   unit: 'mm' },
    { kind: 'number', id: 'letterThickness', labelKey: 'controls.letterThickness', default: 15,  min: 6,  max: 40,  step: 1,   unit: 'mm' },
    { kind: 'number', id: 'gap',             labelKey: 'controls.gap',             default: 10,  min: 0,  max: 60,  step: 1,   unit: 'mm' },
    { kind: 'number', id: 'tolerance',       labelKey: 'controls.tolerance',       default: TOLERANCE_DEFAULT, min: TOLERANCE_MIN, max: TOLERANCE_MAX, step: TOLERANCE_STEP, unit: 'mm' },

    { kind: 'toggle', id: 'includeStand',      labelKey: 'controls.includeStand',      default: true },
    { kind: 'number', id: 'baseWidth',         labelKey: 'controls.baseWidth',         default: 180, min: 60, max: 400, step: 5,   unit: 'mm', visibleWhen: whenBase },
    { kind: 'number', id: 'baseHeight',        labelKey: 'controls.baseHeight',        default: 18,  min: 5,  max: 60,  step: 1,   unit: 'mm', visibleWhen: whenBase },
    { kind: 'number', id: 'baseDepth',         labelKey: 'controls.baseDepth',         default: 45,  min: 15, max: 150, step: 5,   unit: 'mm', visibleWhen: whenBase },
    { kind: 'number', id: 'baseCornerRadius',  labelKey: 'controls.baseCornerRadius',  default: 3,   min: 0,  max: 30,  step: 0.5, unit: 'mm', visibleWhen: whenBase },
    { kind: 'number', id: 'letterEmbed',       labelKey: 'controls.letterEmbed',       default: 3,   min: 0,  max: 15,  step: 0.5, unit: 'mm', visibleWhen: whenBase },
  ],

  presets: [
    {
      id: 'classic',
      nameKey: 'templates.coupleInitials.presets.classic',
      values: { font: 'Cardo', letterColor: '#F5F0E1', separatorColor: '#D62828', separator: '&' },
    },
    {
      id: 'romantic',
      nameKey: 'templates.coupleInitials.presets.romantic',
      values: { font: 'EB Garamond', letterColor: '#F7E7E1', separatorColor: '#B25668', separator: '&' },
    },
    {
      id: 'modern',
      nameKey: 'templates.coupleInitials.presets.modern',
      values: { font: 'Bebas Neue', letterColor: '#111111', separatorColor: '#E5B84B', separator: '+' },
    },
  ],

  validate: (values: ControlValues): ValidationIssue[] => {
    const issues: ValidationIssue[] = []
    const letterThk    = Number(values.letterThickness)
    const tolerance    = Number(values.tolerance)
    const includeStand = Boolean(values.includeStand)
    const baseHeight   = Number(values.baseHeight)
    const letterEmbed  = Number(values.letterEmbed ?? 0)
    if (letterThk < 2) {
      issues.push({ severity: 'warning', messageKey: 'validation.letterThin', params: { min: 2, value: letterThk } })
    }
    if (tolerance === 0 && letterEmbed > 0) {
      issues.push({ severity: 'warning', messageKey: 'validation.zeroTolerance' })
    }
    if (includeStand && letterEmbed > 0 && baseHeight < letterEmbed + 3) {
      issues.push({ severity: 'warning', messageKey: 'validation.baseTooThin', params: { min: letterEmbed + 3 } })
    }
    return issues
  },

  build: async ({ values, mode }) => {
    const i1            = String(values.initial1 ?? 'A').charAt(0) || 'A'
    const i2            = String(values.initial2 ?? 'B').charAt(0) || 'B'
    const sep           = String(values.separator ?? '&').slice(0, 2) || '&'
    const fontName      = String(values.font)
    const letterColor   = String(values.letterColor)
    const separatorColor= String(values.separatorColor)
    const letterHeight  = Number(values.letterHeight)
    const letterThk     = Number(values.letterThickness)
    const gap           = Number(values.gap)
    const tolerance     = Number(values.tolerance)
    const includeStand  = Boolean(values.includeStand)
    const baseWidth     = Number(values.baseWidth)
    const baseHeight    = Number(values.baseHeight)
    const baseDepth     = Number(values.baseDepth)
    const baseCornerR   = Number(values.baseCornerRadius)
    const letterEmbed   = Number(values.letterEmbed ?? 0)

    const font = await loadFont(fontName)

    // The separator visually looks smaller than a full initial — bump it a bit.
    const sepSize = letterHeight * 0.7
    const g1 = extrudeText(i1,  font, { size: letterHeight, depth: letterThk, curveSegments: CURVE_SEGMENTS_VISIBLE })
    const gS = extrudeText(sep, font, { size: sepSize,      depth: letterThk, curveSegments: CURVE_SEGMENTS_VISIBLE })
    const g2 = extrudeText(i2,  font, { size: letterHeight, depth: letterThk, curveSegments: CURVE_SEGMENTS_VISIBLE })

    const w1 = xExtent(g1)
    const wS = xExtent(gS)
    const w2 = xExtent(g2)

    // Center the whole row on x = 0.
    const totalW = w1 + gap + wS + gap + w2
    const x1 = -totalW / 2 + w1 / 2
    const xS =  x1 + w1 / 2 + gap + wS / 2
    const x2 =  xS + wS / 2 + gap + w2 / 2

    const group = new Group()
    group.name = 'couple-initials'

    const letterMat = new MeshStandardMaterial({ color: letterColor,    roughness: 0.55 })
    const sepMat    = new MeshStandardMaterial({ color: separatorColor, roughness: 0.55 })

    const m1 = new Mesh(g1, letterMat); m1.name = 'initial-1'; m1.position.x = x1; m1.castShadow = true; m1.receiveShadow = true
    const mS = new Mesh(gS, sepMat);    mS.name = 'separator'; mS.position.x = xS; mS.castShadow = true; mS.receiveShadow = true
    const m2 = new Mesh(g2, letterMat); m2.name = 'initial-2'; m2.position.x = x2; m2.castShadow = true; m2.receiveShadow = true
    group.add(m1, mS, m2)

    // Bounds of the letter row (world space, without base)
    const rowBounds = new Box3().setFromObject(group)

    if (includeStand) {
      let baseGeom: BufferGeometry = roundedBoxGeometry(baseWidth, baseHeight, baseDepth, baseCornerR, CURVE_SEGMENTS_VISIBLE)
      const embed = letterEmbed > 0 ? letterEmbed : OVERLAP
      const baseY = rowBounds.min.y - baseHeight / 2 + embed

      if (mode === 'export' && letterEmbed > 0) {
        const cutParts: Array<{ geom: BufferGeometry; x: number }> = [
          { geom: extrudeText(i1,  font, { size: letterHeight, depth: letterThk, curveSegments: CURVE_SEGMENTS_CUTTER }), x: x1 },
          { geom: extrudeText(sep, font, { size: sepSize,      depth: letterThk, curveSegments: CURVE_SEGMENTS_CUTTER }), x: xS },
          { geom: extrudeText(i2,  font, { size: letterHeight, depth: letterThk, curveSegments: CURVE_SEGMENTS_CUTTER }), x: x2 },
        ]
        for (const p of cutParts) {
          if (tolerance > 0) {
            const cb = new Box3().setFromBufferAttribute(p.geom.attributes.position as never)
            const avgHalfExtent = (cb.max.x - cb.min.x + cb.max.y - cb.min.y) / 4
            const scaleXY = 1 + tolerance / Math.max(avgHalfExtent, 1)
            p.geom.scale(scaleXY, scaleXY, 1)
          }
          const cutterMatrix = new Matrix4().makeTranslation(p.x, -baseY, 0)
          baseGeom = subtract(baseGeom, p.geom, cutterMatrix)
          p.geom.dispose()
        }
      }

      const base = new Mesh(baseGeom, new MeshStandardMaterial({ color: letterColor, roughness: 0.55 }))
      base.position.set(0, baseY, 0)
      base.name = 'stand'
      base.castShadow = true
      base.receiveShadow = true
      group.add(base)
    }

    const overall = new Box3().setFromObject(group)
    group.position.y = -overall.min.y
    return group
  },

  getExportables: (group) => {
    const letters = new Group()
    const separator = new Group()
    group.traverse((obj) => {
      if (obj.name === 'initial-1' || obj.name === 'initial-2' || obj.name === 'stand') letters.add(obj.clone())
      if (obj.name === 'separator') separator.add(obj.clone())
    })
    return [
      { label: 'letters',   color: '#F5F0E1', object: letters },
      { label: 'separator', color: '#D62828', object: separator },
    ]
  },
}

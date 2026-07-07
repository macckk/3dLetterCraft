import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import type { ControlValues, TemplateDefinition, ValidationIssue } from './types'
import { loadFont } from '@/lib/fonts/loader'
import { extrudeText } from '@/lib/geometry/text'

const OVERLAP = 0.4
const CURVE_SEGMENTS_VISIBLE = 16

const whenConnector = (v: ControlValues) => v.includeConnector === true

export const cakeTopperTemplate: TemplateDefinition = {
  id: 'cake-topper',
  nameKey: 'templates.cakeTopper.name',
  descriptionKey: 'templates.cakeTopper.description',
  controls: [
    { kind: 'text',  id: 'text',       labelKey: 'controls.text',       default: 'Marcelo', maxLength: 32 },
    { kind: 'font',  id: 'font',       labelKey: 'controls.font',       default: 'Sacramento', category: 'script' },
    { kind: 'color', id: 'color',      labelKey: 'controls.color',      default: '#E5B84B' },

    { kind: 'number', id: 'textHeight', labelKey: 'controls.textHeight', default: 60, min: 25, max: 150, step: 2,   unit: 'mm' },
    { kind: 'number', id: 'thickness',  labelKey: 'controls.thickness',  default: 4,  min: 2,  max: 15,  step: 0.5, unit: 'mm' },

    { kind: 'toggle', id: 'includeConnector', labelKey: 'controls.includeConnector', default: true },
    { kind: 'number', id: 'connectorHeight',  labelKey: 'controls.connectorHeight',  default: 3, min: 1,    max: 15, step: 0.5, unit: 'mm', visibleWhen: whenConnector },
    { kind: 'number', id: 'barGap',           labelKey: 'controls.barGap',           default: 0, min: -3,   max: 15, step: 0.5, unit: 'mm', visibleWhen: whenConnector },

    { kind: 'number', id: 'stickCount',   labelKey: 'controls.stickCount',   default: 2, min: 1, max: 3, step: 1,   unit: '' },
    { kind: 'number', id: 'stickWidth',   labelKey: 'controls.stickWidth',   default: 3,  min: 1.5, max: 10, step: 0.5, unit: 'mm' },
    { kind: 'number', id: 'stickLength',  labelKey: 'controls.stickLength',  default: 50, min: 15,  max: 120, step: 5, unit: 'mm' },
    { kind: 'number', id: 'stickSpacing', labelKey: 'controls.stickSpacing', default: 40, min: 10,  max: 200, step: 5, unit: 'mm' },
  ],

  presets: [
    { id: 'gold',  nameKey: 'templates.cakeTopper.presets.gold',  values: { font: 'Sacramento', color: '#E5B84B' } },
    { id: 'rose',  nameKey: 'templates.cakeTopper.presets.rose',  values: { font: 'Allura',     color: '#B25668' } },
    { id: 'black', nameKey: 'templates.cakeTopper.presets.black', values: { font: 'Pacifico',   color: '#111111' } },
  ],

  validate: (values: ControlValues): ValidationIssue[] => {
    const issues: ValidationIssue[] = []
    const thickness   = Number(values.thickness)
    const stickWidth  = Number(values.stickWidth)
    const stickLength = Number(values.stickLength)
    if (thickness < 2) {
      issues.push({ severity: 'warning', messageKey: 'validation.letterThin', params: { min: 2, value: thickness } })
    }
    if (stickWidth < 1.5) {
      issues.push({ severity: 'warning', messageKey: 'validation.stickTooThin', params: { min: 1.5, value: stickWidth } })
    }
    if (stickLength < 25) {
      issues.push({ severity: 'warning', messageKey: 'validation.stickTooShort', params: { min: 25, value: stickLength } })
    }
    return issues
  },

  build: async ({ values }) => {
    const text        = String(values.text ?? 'Nome').trim() || 'Nome'
    const fontName    = String(values.font)
    const color       = String(values.color)
    const textHeight  = Number(values.textHeight)
    const thickness   = Number(values.thickness)
    const includeConnector = Boolean(values.includeConnector)
    const connectorHeight  = Number(values.connectorHeight)
    const barGap           = Number(values.barGap ?? 0)
    const stickCount   = Math.max(1, Math.min(3, Math.round(Number(values.stickCount))))
    const stickWidth   = Number(values.stickWidth)
    const stickLength  = Number(values.stickLength)
    const stickSpacing = Number(values.stickSpacing)

    const font = await loadFont(fontName)

    const textGeom = extrudeText(text, font, {
      size: textHeight,
      depth: thickness,
      curveSegments: CURVE_SEGMENTS_VISIBLE,
    })
    const tb = new Box3().setFromBufferAttribute(textGeom.attributes.position as never)
    const tMinY = tb.min.y
    const tMinX = tb.min.x
    const tMaxX = tb.max.x

    const group = new Group()
    group.name = 'cake-topper'

    const mat = new MeshStandardMaterial({ color, roughness: 0.5 })

    const textMesh = new Mesh(textGeom, mat)
    textMesh.name = 'topper-text'
    textMesh.castShadow = true
    group.add(textMesh)

    // Connector bar: positioned barGap mm below the text (negative = overlap into text).
    // barTopY = tMinY - barGap; barBottomY = barTopY - connectorHeight.
    let stickTopY = tMinY + OVERLAP
    let stickReach = stickLength  // total stick length below text
    if (includeConnector) {
      const barW = tMaxX - tMinX + 4
      const barTopY = tMinY - barGap
      const barCenterY = barTopY - connectorHeight / 2
      const barGeom = new BoxGeometry(barW, connectorHeight, thickness)
      const bar = new Mesh(barGeom, mat)
      bar.name = 'connector'
      bar.position.set((tMinX + tMaxX) / 2, barCenterY, thickness / 2)
      bar.castShadow = true
      group.add(bar)
      // Sticks anchor into text (stickTopY = tMinY + OVERLAP) and reach below the bar
      // by the user's stickLength. Total geometry length spans text→gap→bar→below.
      stickReach = OVERLAP + Math.max(0, barGap) + connectorHeight + stickLength
    }

    // Sticks — placed symmetrically around x=0
    const positions: number[] = []
    if (stickCount === 1) {
      positions.push(0)
    } else if (stickCount === 2) {
      positions.push(-stickSpacing / 2, stickSpacing / 2)
    } else {
      positions.push(-stickSpacing, 0, stickSpacing)
    }
    for (const sx of positions) {
      const sGeom = new BoxGeometry(stickWidth, stickReach, thickness)
      const s = new Mesh(sGeom, mat)
      s.name = 'stick'
      s.position.set(sx, stickTopY - stickReach / 2, thickness / 2)
      s.castShadow = true
      group.add(s)
    }

    // Lift so bottom sits on y = 0
    const overall = new Box3().setFromObject(group)
    group.position.y = -overall.min.y
    return group
  },
}

import { Box3, ExtrudeGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Path, Shape } from 'three'
import type { BufferGeometry } from 'three'
import type { ControlValues, TemplateDefinition, ValidationIssue } from './types'
import { TOLERANCE_DEFAULT, TOLERANCE_MAX, TOLERANCE_MIN, TOLERANCE_STEP } from '@/lib/tolerance'
import { loadFont } from '@/lib/fonts/loader'
import { extrudeText } from '@/lib/geometry/text'
import { subtract } from '@/lib/geometry/csg'

const OVERLAP = 0.4
const CURVE_SEGMENTS_VISIBLE = 24
const CURVE_SEGMENTS_CUTTER = 12

const whenHole = (v: ControlValues) => v.includeHole === true

/**
 * Build a rounded-rectangle plate with a circular lobe extending on one side
 * to host a keyring hole. The whole thing is a single Shape so it extrudes as
 * one solid mesh.
 */
function keychainPlateShape(
  bodyMinX: number,
  bodyMaxX: number,
  bodyMinY: number,
  bodyMaxY: number,
  cornerR: number,
  lobe?: { cx: number; cy: number; r: number; side: 'left' | 'right' },
): Shape {
  const w = bodyMaxX - bodyMinX
  const h = bodyMaxY - bodyMinY
  const r = Math.max(0, Math.min(cornerR, w / 2, h / 2))
  const s = new Shape()

  if (!lobe) {
    // Plain rounded rectangle
    s.moveTo(bodyMinX + r, bodyMinY)
    s.lineTo(bodyMaxX - r, bodyMinY)
    s.quadraticCurveTo(bodyMaxX, bodyMinY, bodyMaxX, bodyMinY + r)
    s.lineTo(bodyMaxX, bodyMaxY - r)
    s.quadraticCurveTo(bodyMaxX, bodyMaxY, bodyMaxX - r, bodyMaxY)
    s.lineTo(bodyMinX + r, bodyMaxY)
    s.quadraticCurveTo(bodyMinX, bodyMaxY, bodyMinX, bodyMaxY - r)
    s.lineTo(bodyMinX, bodyMinY + r)
    s.quadraticCurveTo(bodyMinX, bodyMinY, bodyMinX + r, bodyMinY)
    return s
  }

  // Rounded rectangle fused with a circle lobe on one side.
  // Trace the outline: start at the lobe-attachment corner and go around.
  const arcSamples = 48
  if (lobe.side === 'left') {
    // Trace: from lobe's top-tangent → across rect top-left corner → around rect → bottom-left corner → lobe's bottom-tangent → around lobe back to start.
    s.moveTo(bodyMinX, bodyMaxY - r)
    s.quadraticCurveTo(bodyMinX, bodyMaxY, bodyMinX + r, bodyMaxY)
    s.lineTo(bodyMaxX - r, bodyMaxY)
    s.quadraticCurveTo(bodyMaxX, bodyMaxY, bodyMaxX, bodyMaxY - r)
    s.lineTo(bodyMaxX, bodyMinY + r)
    s.quadraticCurveTo(bodyMaxX, bodyMinY, bodyMaxX - r, bodyMinY)
    s.lineTo(bodyMinX + r, bodyMinY)
    s.quadraticCurveTo(bodyMinX, bodyMinY, bodyMinX, bodyMinY + r)
    // From (bodyMinX, bodyMinY + r) we jump directly across the lobe with an arc.
    // Draw lobe as arc going counter-clockwise from angle=~90° back to ~270°
    // relative to lobe center. Just approximate with a circle segment on the left side.
    for (let i = 1; i <= arcSamples; i++) {
      const t = Math.PI / 2 + (i / arcSamples) * Math.PI  // 90° → 270° (through 180°)
      const px = lobe.cx + lobe.r * Math.cos(t)
      const py = lobe.cy + lobe.r * Math.sin(t)
      s.lineTo(px, py)
    }
    // Close back to start
    s.lineTo(bodyMinX, bodyMaxY - r)
  } else {
    // Mirror: lobe on the right
    s.moveTo(bodyMaxX, bodyMinY + r)
    s.quadraticCurveTo(bodyMaxX, bodyMinY, bodyMaxX - r, bodyMinY)
    s.lineTo(bodyMinX + r, bodyMinY)
    s.quadraticCurveTo(bodyMinX, bodyMinY, bodyMinX, bodyMinY + r)
    s.lineTo(bodyMinX, bodyMaxY - r)
    s.quadraticCurveTo(bodyMinX, bodyMaxY, bodyMinX + r, bodyMaxY)
    s.lineTo(bodyMaxX - r, bodyMaxY)
    s.quadraticCurveTo(bodyMaxX, bodyMaxY, bodyMaxX, bodyMaxY - r)
    for (let i = 1; i <= arcSamples; i++) {
      const t = -Math.PI / 2 + (i / arcSamples) * Math.PI  // -90° → 90° (through 0°)
      const px = lobe.cx + lobe.r * Math.cos(t)
      const py = lobe.cy + lobe.r * Math.sin(t)
      s.lineTo(px, py)
    }
    s.lineTo(bodyMaxX, bodyMinY + r)
  }
  return s
}

function pushHole(shape: Shape, cx: number, cy: number, radius: number, samples = 48) {
  const h = new Path()
  for (let i = samples; i >= 0; i--) {
    const t = (i / samples) * Math.PI * 2
    const px = cx + radius * Math.cos(t)
    const py = cy + radius * Math.sin(t)
    if (i === samples) h.moveTo(px, py)
    else h.lineTo(px, py)
  }
  shape.holes.push(h)
}

export const nameKeychainTemplate: TemplateDefinition = {
  id: 'name-keychain',
  nameKey: 'templates.nameKeychain.name',
  descriptionKey: 'templates.nameKeychain.description',
  controls: [
    { kind: 'text',  id: 'text',        labelKey: 'controls.text',        default: 'Name', maxLength: 20 },
    { kind: 'font',  id: 'font',        labelKey: 'controls.font',        default: 'Poppins', category: 'sans' },
    { kind: 'color', id: 'textColor',   labelKey: 'controls.textColor',   default: '#F5F0E1' },
    { kind: 'color', id: 'plateColor',  labelKey: 'controls.plateColor',  default: '#D62828' },

    { kind: 'number', id: 'textHeight',    labelKey: 'controls.textHeight',    default: 28, min: 12, max: 100, step: 1,   unit: 'mm' },
    { kind: 'number', id: 'textThickness', labelKey: 'controls.textThickness', default: 2.5,min: 1,  max: 8,   step: 0.5, unit: 'mm' },

    { kind: 'number', id: 'plateThickness',labelKey: 'controls.plateThickness',default: 3,  min: 1.5,max: 10,  step: 0.5, unit: 'mm' },
    { kind: 'number', id: 'platePadX',     labelKey: 'controls.platePadX',     default: 6,  min: 2,  max: 30,  step: 0.5, unit: 'mm' },
    { kind: 'number', id: 'platePadY',     labelKey: 'controls.platePadY',     default: 5,  min: 2,  max: 30,  step: 0.5, unit: 'mm' },
    { kind: 'number', id: 'plateCornerR',  labelKey: 'controls.plateCornerR',  default: 6,  min: 0,  max: 30,  step: 0.5, unit: 'mm' },

    { kind: 'toggle', id: 'includeHole',  labelKey: 'controls.includeHole',  default: true },
    { kind: 'number', id: 'holeDiameter', labelKey: 'controls.holeDiameter', default: 5, min: 2, max: 15, step: 0.5, unit: 'mm', visibleWhen: whenHole },
    { kind: 'number', id: 'holeWall',     labelKey: 'controls.holeWall',     default: 3, min: 1.5, max: 15, step: 0.5, unit: 'mm', visibleWhen: whenHole },
    { kind: 'toggle', id: 'holeOnRight',  labelKey: 'controls.holeOnRight',  default: false, visibleWhen: whenHole },

    { kind: 'number', id: 'tolerance',    labelKey: 'controls.tolerance',    default: TOLERANCE_DEFAULT, min: TOLERANCE_MIN, max: TOLERANCE_MAX, step: TOLERANCE_STEP, unit: 'mm' },
    { kind: 'number', id: 'textEmbed',    labelKey: 'controls.textEmbed',    default: 1, min: 0, max: 5, step: 0.5, unit: 'mm' },
    { kind: 'toggle', id: 'separateParts',labelKey: 'controls.separateParts',default: true },
  ],

  presets: [
    { id: 'red',   nameKey: 'templates.nameKeychain.presets.red',   values: { font: 'Poppins',    plateColor: '#D62828', textColor: '#F5F0E1' } },
    { id: 'black', nameKey: 'templates.nameKeychain.presets.black', values: { font: 'Bebas Neue', plateColor: '#111111', textColor: '#F5F0E1' } },
    { id: 'green', nameKey: 'templates.nameKeychain.presets.green', values: { font: 'Montserrat', plateColor: '#2E7D32', textColor: '#F5F0E1' } },
  ],

  validate: (values: ControlValues): ValidationIssue[] => {
    const issues: ValidationIssue[] = []
    const textThk  = Number(values.textThickness)
    const plateThk = Number(values.plateThickness)
    const embed    = Number(values.textEmbed ?? 0)
    const tolerance= Number(values.tolerance)
    if (textThk < 1) {
      issues.push({ severity: 'warning', messageKey: 'validation.letterThin', params: { min: 1, value: textThk } })
    }
    if (plateThk < 1.5) {
      issues.push({ severity: 'warning', messageKey: 'validation.baseTooThin', params: { min: 1.5 } })
    }
    if (embed > 0 && embed > plateThk - 0.6) {
      issues.push({ severity: 'warning', messageKey: 'validation.pocketTooDeep', params: { letterThk: plateThk } })
    }
    if (tolerance === 0 && embed > 0) {
      issues.push({ severity: 'warning', messageKey: 'validation.zeroTolerance' })
    }
    return issues
  },

  build: async ({ values, mode }) => {
    const text          = String(values.text ?? 'Name').trim() || 'Name'
    const fontName      = String(values.font)
    const textColor     = String(values.textColor)
    const plateColor    = String(values.plateColor)
    const textHeight    = Number(values.textHeight)
    const textThickness = Number(values.textThickness)
    const plateThickness= Number(values.plateThickness)
    const platePadX     = Number(values.platePadX)
    const platePadY     = Number(values.platePadY)
    const plateCornerR  = Number(values.plateCornerR)
    const includeHole   = Boolean(values.includeHole)
    const holeDiameter  = Number(values.holeDiameter)
    const holeWall      = Number(values.holeWall)
    const holeOnRight   = Boolean(values.holeOnRight)
    const tolerance     = Number(values.tolerance)
    const textEmbed     = Number(values.textEmbed ?? 0)
    const separateParts = Boolean(values.separateParts ?? true)

    const font = await loadFont(fontName)

    // Text — extruded, centered on origin by extrudeText helper.
    const textGeom = extrudeText(text, font, {
      size: textHeight,
      depth: textThickness,
      curveSegments: CURVE_SEGMENTS_VISIBLE,
    })
    const tb = new Box3().setFromBufferAttribute(textGeom.attributes.position as never)
    const textWidth  = tb.max.x - tb.min.x
    const textHeightBB = tb.max.y - tb.min.y

    // Plate body dims (centered on origin like the text).
    const bodyMinX = -textWidth / 2 - platePadX
    const bodyMaxX =  textWidth / 2 + platePadX
    const bodyMinY = -textHeightBB / 2 - platePadY
    const bodyMaxY =  textHeightBB / 2 + platePadY

    // Lobe params — outside the body on the chosen side.
    const holeR = holeDiameter / 2
    const lobeR = holeR + holeWall
    const lobeCX = holeOnRight ? bodyMaxX + lobeR : bodyMinX - lobeR
    const lobeCY = 0

    const plateShape = keychainPlateShape(
      bodyMinX, bodyMaxX, bodyMinY, bodyMaxY,
      plateCornerR,
      includeHole ? { cx: lobeCX, cy: lobeCY, r: lobeR, side: holeOnRight ? 'right' : 'left' } : undefined,
    )
    if (includeHole) pushHole(plateShape, lobeCX, lobeCY, holeR)

    let plateGeom: BufferGeometry = new ExtrudeGeometry(plateShape, {
      depth: plateThickness,
      curveSegments: CURVE_SEGMENTS_VISIBLE,
      bevelEnabled: false,
    })

    // Optional embed pocket — carves a shallow text-shaped socket into the plate
    // top so the printed text piece drops in and can be glued in place.
    if (mode === 'export' && textEmbed > 0) {
      const cutter = extrudeText(text, font, {
        size: textHeight,
        depth: textEmbed + OVERLAP,
        curveSegments: CURVE_SEGMENTS_CUTTER,
      })
      if (tolerance > 0) {
        const cb = new Box3().setFromBufferAttribute(cutter.attributes.position as never)
        const avgHalfExtent = (cb.max.x - cb.min.x + cb.max.y - cb.min.y) / 4
        const scaleXY = 1 + tolerance / Math.max(avgHalfExtent, 1)
        cutter.scale(scaleXY, scaleXY, 1)
      }
      const cutMatrix = new Matrix4().makeTranslation(0, 0, plateThickness - textEmbed)
      plateGeom = subtract(plateGeom, cutter, cutMatrix)
      cutter.dispose()
    }

    const group = new Group()
    group.name = 'name-keychain'
    group.userData.separateParts = separateParts

    const plateMat = new MeshStandardMaterial({ color: plateColor, roughness: 0.55 })
    const textMat  = new MeshStandardMaterial({ color: textColor,  roughness: 0.5 })

    // Plate sits from Z = 0 to plateThickness.
    const plateMesh = new Mesh(plateGeom, plateMat)
    plateMesh.name = 'plate'
    plateMesh.castShadow = true
    plateMesh.receiveShadow = true
    group.add(plateMesh)

    // Text sits on top of the plate. If embedded, sink into the plate by textEmbed.
    const textZ = textEmbed > 0
      ? plateThickness - textEmbed
      : plateThickness - OVERLAP
    const textMesh = new Mesh(textGeom, textMat)
    textMesh.name = 'text'
    textMesh.position.z = textZ
    textMesh.castShadow = true
    group.add(textMesh)

    // Rest on Y=0 for the viewer.
    const overall = new Box3().setFromObject(group)
    group.position.y = -overall.min.y
    return group
  },

  getExportables: (group) => {
    const separateParts = group.userData.separateParts !== false
    if (!separateParts) {
      const all = new Group()
      group.traverse((obj) => {
        if (obj.name === 'plate' || obj.name === 'text') all.add(obj.clone())
      })
      return [{ label: 'all', color: '#F5F0E1', object: all }]
    }
    const plate = new Group()
    const textParts = new Group()
    group.traverse((obj) => {
      if (obj.name === 'plate') plate.add(obj.clone())
      if (obj.name === 'text') textParts.add(obj.clone())
    })
    return [
      { label: 'plate', color: '#D62828', object: plate },
      { label: 'text',  color: '#F5F0E1', object: textParts },
    ]
  },
}

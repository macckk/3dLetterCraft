import { Box3, CylinderGeometry, ExtrudeGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Path, Shape } from 'three'
import type { BufferGeometry } from 'three'
import type { ControlValues, TemplateDefinition, ValidationIssue } from './types'
import { TOLERANCE_DEFAULT, TOLERANCE_MAX, TOLERANCE_MIN, TOLERANCE_STEP } from '@/lib/tolerance'
import { loadFont } from '@/lib/fonts/loader'
import { extrudeText } from '@/lib/geometry/text'
import { subtract, unionAll } from '@/lib/geometry/csg'
import { outlineTextShapes, shapesBounds, shiftShape } from '@/lib/geometry/offset'

const OVERLAP = 0.4
const CURVE_SEGMENTS_VISIBLE = 24
const CURVE_SEGMENTS_CUTTER = 12

const whenHole = (v: ControlValues) => v.includeHole === true
const whenOutline = (v: ControlValues) => v.plateOutline === true
const whenRect = (v: ControlValues) => v.plateOutline !== true

function roundedRectShape(minX: number, maxX: number, minY: number, maxY: number, r: number): Shape {
  const rr = Math.max(0, Math.min(r, (maxX - minX) / 2, (maxY - minY) / 2))
  const s = new Shape()
  s.moveTo(minX + rr, minY)
  s.lineTo(maxX - rr, minY)
  s.quadraticCurveTo(maxX, minY, maxX, minY + rr)
  s.lineTo(maxX, maxY - rr)
  s.quadraticCurveTo(maxX, maxY, maxX - rr, maxY)
  s.lineTo(minX + rr, maxY)
  s.quadraticCurveTo(minX, maxY, minX, maxY - rr)
  s.lineTo(minX, minY + rr)
  s.quadraticCurveTo(minX, minY, minX + rr, minY)
  return s
}

function circleShape(cx: number, cy: number, r: number, samples = 64): Shape {
  const s = new Shape()
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI * 2
    const px = cx + r * Math.cos(t)
    const py = cy + r * Math.sin(t)
    if (i === 0) s.moveTo(px, py)
    else s.lineTo(px, py)
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
    { kind: 'text',  id: 'text',        labelKey: 'controls.text',        default: 'Nicole', maxLength: 20 },
    { kind: 'font',  id: 'font',        labelKey: 'controls.font',        default: 'Pacifico', category: 'script' },
    { kind: 'color', id: 'textColor',   labelKey: 'controls.textColor',   default: '#F5F0E1' },
    { kind: 'color', id: 'plateColor',  labelKey: 'controls.plateColor',  default: '#E91E63' },

    { kind: 'number', id: 'textHeight',    labelKey: 'controls.textHeight',    default: 30, min: 12, max: 100, step: 1,   unit: 'mm' },
    { kind: 'number', id: 'textThickness', labelKey: 'controls.textThickness', default: 2.5, min: 1, max: 8,   step: 0.5, unit: 'mm' },
    { kind: 'number', id: 'plateThickness',labelKey: 'controls.plateThickness',default: 3,  min: 1.5, max: 10, step: 0.5, unit: 'mm' },

    { kind: 'toggle', id: 'plateOutline',  labelKey: 'controls.plateOutline', default: true },
    { kind: 'number', id: 'outlineWidth',  labelKey: 'controls.outlineWidth', default: 3.5, min: 1, max: 12, step: 0.5, unit: 'mm', visibleWhen: whenOutline },

    { kind: 'number', id: 'platePadX',     labelKey: 'controls.platePadX',     default: 6, min: 2, max: 30, step: 0.5, unit: 'mm', visibleWhen: whenRect },
    { kind: 'number', id: 'platePadY',     labelKey: 'controls.platePadY',     default: 5, min: 2, max: 30, step: 0.5, unit: 'mm', visibleWhen: whenRect },
    { kind: 'number', id: 'plateCornerR',  labelKey: 'controls.plateCornerR',  default: 6, min: 0, max: 30, step: 0.5, unit: 'mm', visibleWhen: whenRect },

    { kind: 'toggle', id: 'includeHole',  labelKey: 'controls.includeHole',  default: true },
    { kind: 'number', id: 'holeDiameter', labelKey: 'controls.holeDiameter', default: 5, min: 2, max: 15, step: 0.5, unit: 'mm', visibleWhen: whenHole },
    { kind: 'number', id: 'holeWall',     labelKey: 'controls.holeWall',     default: 3, min: 1.5, max: 15, step: 0.5, unit: 'mm', visibleWhen: whenHole },
    { kind: 'number', id: 'holeOverlap',  labelKey: 'controls.holeOverlap',  default: 3, min: 0.5, max: 15, step: 0.5, unit: 'mm', visibleWhen: whenHole },
    { kind: 'toggle', id: 'holeOnRight',  labelKey: 'controls.holeOnRight',  default: false, visibleWhen: whenHole },

    { kind: 'number', id: 'tolerance',    labelKey: 'controls.tolerance',    default: TOLERANCE_DEFAULT, min: TOLERANCE_MIN, max: TOLERANCE_MAX, step: TOLERANCE_STEP, unit: 'mm' },
    { kind: 'number', id: 'textEmbed',    labelKey: 'controls.textEmbed',    default: 1, min: 0, max: 5, step: 0.5, unit: 'mm' },
    { kind: 'toggle', id: 'separateParts',labelKey: 'controls.separateParts',default: true },
  ],

  presets: [
    { id: 'red',   nameKey: 'templates.nameKeychain.presets.red',   values: { font: 'Poppins',    plateColor: '#D62828', textColor: '#F5F0E1', plateOutline: false } },
    { id: 'pink',  nameKey: 'templates.nameKeychain.presets.pink',  values: { font: 'Pacifico',   plateColor: '#E91E63', textColor: '#F5F0E1', plateOutline: true, outlineWidth: 3.5 } },
    { id: 'black', nameKey: 'templates.nameKeychain.presets.black', values: { font: 'Bebas Neue', plateColor: '#111111', textColor: '#F5F0E1', plateOutline: false } },
    { id: 'green', nameKey: 'templates.nameKeychain.presets.green', values: { font: 'Montserrat', plateColor: '#2E7D32', textColor: '#F5F0E1', plateOutline: false } },
  ],

  validate: (values: ControlValues): ValidationIssue[] => {
    const issues: ValidationIssue[] = []
    const textThk  = Number(values.textThickness)
    const plateThk = Number(values.plateThickness)
    const embed    = Number(values.textEmbed ?? 0)
    const tolerance= Number(values.tolerance)
    const outline  = Number(values.outlineWidth ?? 0)
    const isOutline= Boolean(values.plateOutline)
    if (textThk < 1) {
      issues.push({ severity: 'warning', messageKey: 'validation.letterThin', params: { min: 1, value: textThk } })
    }
    if (plateThk < 1.5) {
      issues.push({ severity: 'warning', messageKey: 'validation.baseTooThin', params: { min: 1.5 } })
    }
    if (isOutline && outline < 1.5) {
      issues.push({ severity: 'warning', messageKey: 'validation.scriptReliefThin', params: { min: 1.5, value: outline } })
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
    const text          = String(values.text ?? 'Nome').trim() || 'Nome'
    const fontName      = String(values.font)
    const textColor     = String(values.textColor)
    const plateColor    = String(values.plateColor)
    const textHeight    = Number(values.textHeight)
    const textThickness = Number(values.textThickness)
    const plateThickness= Number(values.plateThickness)
    const plateOutline  = Boolean(values.plateOutline ?? true)
    const outlineWidth  = Number(values.outlineWidth ?? 3.5)
    const platePadX     = Number(values.platePadX ?? 6)
    const platePadY     = Number(values.platePadY ?? 5)
    const plateCornerR  = Number(values.plateCornerR ?? 6)
    const includeHole   = Boolean(values.includeHole)
    const holeDiameter  = Number(values.holeDiameter)
    const holeWall      = Number(values.holeWall)
    const holeOverlap   = Number(values.holeOverlap ?? 3)
    const holeOnRight   = Boolean(values.holeOnRight)
    const tolerance     = Number(values.tolerance)
    const textEmbed     = Number(values.textEmbed ?? 0)
    const separateParts = Boolean(values.separateParts ?? true)

    const font = await loadFont(fontName)

    // ── Raised text (same for both plate styles) ─────────────────────────
    const textGeom = extrudeText(text, font, {
      size: textHeight,
      depth: textThickness,
      curveSegments: CURVE_SEGMENTS_VISIBLE,
    })
    const tb = new Box3().setFromBufferAttribute(textGeom.attributes.position as never)
    const textWidth  = tb.max.x - tb.min.x
    const textHeightBB = tb.max.y - tb.min.y

    // ── Plate ────────────────────────────────────────────────────────────
    let plateGeom: BufferGeometry
    let plateMinX: number, plateMaxX: number, plateMidY: number

    if (plateOutline) {
      // Letter-hugging outline: grow each glyph outward by `outlineWidth`.
      const glyphShapes = font.generateShapes(text, textHeight)
      const b = shapesBounds(glyphShapes)
      const cx = (b.minX + b.maxX) / 2
      const cy = (b.minY + b.maxY) / 2
      for (const g of glyphShapes) shiftShape(g, -cx, -cy)
      const outlined = outlineTextShapes(glyphShapes, outlineWidth, 16)
      if (mode === 'export' && outlined.length > 1) {
        // Export: fuse per-glyph outlines with CSG union so the STL has no
        // internal seams between overlapping letters and no side cracks from
        // near-tangent contours.
        const perGlyph = outlined.map((sh) => new ExtrudeGeometry(sh, {
          depth: plateThickness,
          curveSegments: CURVE_SEGMENTS_VISIBLE,
          bevelEnabled: false,
        }))
        plateGeom = unionAll(perGlyph)
      } else {
        plateGeom = new ExtrudeGeometry(outlined, {
          depth: plateThickness,
          curveSegments: CURVE_SEGMENTS_VISIBLE,
          bevelEnabled: false,
        })
      }
      plateMinX = -textWidth / 2 - outlineWidth
      plateMaxX =  textWidth / 2 + outlineWidth
      plateMidY = 0
    } else {
      // Rounded rectangle plate.
      const bodyMinX = -textWidth / 2 - platePadX
      const bodyMaxX =  textWidth / 2 + platePadX
      const bodyMinY = -textHeightBB / 2 - platePadY
      const bodyMaxY =  textHeightBB / 2 + platePadY
      const bodyShape = roundedRectShape(bodyMinX, bodyMaxX, bodyMinY, bodyMaxY, plateCornerR)
      plateGeom = new ExtrudeGeometry(bodyShape, {
        depth: plateThickness,
        curveSegments: CURVE_SEGMENTS_VISIBLE,
        bevelEnabled: false,
      })
      plateMinX = bodyMinX
      plateMaxX = bodyMaxX
      plateMidY = (bodyMinY + bodyMaxY) / 2
    }

    // ── Keyring lobe (separate mesh, overlaps plate → slicer merges) ─────
    let lobeGeom: BufferGeometry | undefined
    if (includeHole) {
      const holeR = holeDiameter / 2
      const lobeR = holeR + holeWall
      // Position so the lobe overlaps the plate by `holeOverlap` mm.
      const lobeCX = holeOnRight
        ? plateMaxX + lobeR - holeOverlap
        : plateMinX - lobeR + holeOverlap
      const lobeCY = plateMidY
      const lobeShape = circleShape(lobeCX, lobeCY, lobeR, 64)
      pushHole(lobeShape, lobeCX, lobeCY, holeR, 48)
      lobeGeom = new ExtrudeGeometry(lobeShape, {
        depth: plateThickness,
        curveSegments: CURVE_SEGMENTS_VISIBLE,
        bevelEnabled: false,
      })
    }
    // silence unused warning
    void CylinderGeometry

    // ── Fuse lobe into plate for a single, seamless plate STL (export) ──
    if (mode === 'export' && lobeGeom) {
      plateGeom = unionAll([plateGeom, lobeGeom])
      lobeGeom = undefined
    }

    // ── Text-shaped registration pocket in the plate top (export only) ───
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

    // ── Assemble ─────────────────────────────────────────────────────────
    const group = new Group()
    group.name = 'name-keychain'
    group.userData.separateParts = separateParts

    const plateMat = new MeshStandardMaterial({ color: plateColor, roughness: 0.55 })
    const textMat  = new MeshStandardMaterial({ color: textColor,  roughness: 0.5 })

    const plateMesh = new Mesh(plateGeom, plateMat)
    plateMesh.name = 'plate'
    plateMesh.castShadow = true
    plateMesh.receiveShadow = true
    group.add(plateMesh)

    if (lobeGeom) {
      const lobeMesh = new Mesh(lobeGeom, plateMat)
      lobeMesh.name = 'plate-lobe'
      lobeMesh.castShadow = true
      lobeMesh.receiveShadow = true
      group.add(lobeMesh)
    }

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
        if (obj.name === 'plate' || obj.name === 'plate-lobe' || obj.name === 'text') all.add(obj.clone())
      })
      return [{ label: 'all', color: '#F5F0E1', object: all }]
    }
    const plate = new Group()
    const textParts = new Group()
    group.traverse((obj) => {
      if (obj.name === 'plate' || obj.name === 'plate-lobe') plate.add(obj.clone())
      if (obj.name === 'text') textParts.add(obj.clone())
    })
    return [
      { label: 'plate', color: '#E91E63', object: plate },
      { label: 'text',  color: '#F5F0E1', object: textParts },
    ]
  },
}

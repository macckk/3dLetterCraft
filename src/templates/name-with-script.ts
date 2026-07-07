import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import type { TemplateDefinition } from './types'
import { TOLERANCE_DEFAULT, TOLERANCE_MAX, TOLERANCE_MIN, TOLERANCE_STEP } from '@/lib/tolerance'

/**
 * Placeholder geometry — replaces the real text extrusion in the next iteration.
 * The plugin architecture and controls schema are the point of this file for now.
 */
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
  build: ({ values }) => {
    // Placeholder box representing the big letter, plus a slab for the base.
    const group = new Group()
    group.name = 'name-with-script'

    const bigHeight = values.bigHeight as number
    const baseThickness = values.baseThickness as number
    const scriptDepth = values.scriptDepth as number
    const includeStand = values.includeStand as boolean

    // Big letter placeholder
    const bigMat = new MeshStandardMaterial({ color: values.bigColor as string, roughness: 0.6 })
    const bigMesh = new Mesh(
      new BoxGeometry(bigHeight * 0.75, bigHeight, baseThickness),
      bigMat
    )
    bigMesh.position.set(0, bigHeight / 2, 0)
    bigMesh.name = 'big-letter'
    group.add(bigMesh)

    // Script layer placeholder (a thin slab in front)
    const scriptMat = new MeshStandardMaterial({ color: values.scriptColor as string, roughness: 0.5 })
    const scriptMesh = new Mesh(
      new BoxGeometry(bigHeight * 0.55, bigHeight * 0.25, scriptDepth),
      scriptMat
    )
    scriptMesh.position.set(0, bigHeight * 0.45, baseThickness / 2 + scriptDepth / 2)
    scriptMesh.name = 'script-text'
    group.add(scriptMesh)

    // Stand
    if (includeStand) {
      const standMat = new MeshStandardMaterial({ color: values.bigColor as string, roughness: 0.6 })
      const standMesh = new Mesh(
        new BoxGeometry(bigHeight, baseThickness * 1.3, baseThickness * 2.5),
        standMat
      )
      standMesh.position.set(0, -baseThickness * 0.65, 0)
      standMesh.name = 'stand'
      group.add(standMesh)
    }

    return group
  },
  getExportables: (group) => {
    const bigParts: Group = new Group()
    const scriptParts: Group = new Group()
    group.traverse((obj) => {
      if (obj.name === 'big-letter' || obj.name === 'stand') bigParts.add(obj.clone())
      if (obj.name === 'script-text') scriptParts.add(obj.clone())
    })
    return [
      { label: 'big', color: '#F5F0E1', object: bigParts },
      { label: 'script', color: '#D62828', object: scriptParts },
    ]
  },
}

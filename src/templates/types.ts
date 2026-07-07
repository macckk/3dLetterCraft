import type { Group } from 'three'
import type { TFunction } from 'i18next'

export type ControlType =
  | { kind: 'text'; id: string; labelKey: string; default: string; maxLength?: number }
  | { kind: 'number'; id: string; labelKey: string; default: number; min: number; max: number; step: number; unit?: string }
  | { kind: 'color'; id: string; labelKey: string; default: string }
  | { kind: 'font'; id: string; labelKey: string; default: string; category?: 'serif' | 'script' | 'sans' }
  | { kind: 'toggle'; id: string; labelKey: string; default: boolean }

export type ControlValues = Record<string, string | number | boolean>

export type BuildMode = 'preview' | 'export'

export interface BuildContext {
  values: ControlValues
  t: TFunction
  /**
   * 'preview' — fast, may skip expensive CSG (used in the 3D viewer).
   * 'export' — accurate geometry ready for STL/3MF output.
   */
  mode: BuildMode
}

export interface TemplateDefinition {
  id: string
  nameKey: string  // i18n key, e.g. "templates.nameWithScript.name"
  descriptionKey: string
  thumbnail?: string
  controls: ControlType[]
  build: (ctx: BuildContext) => Promise<Group> | Group
  /**
   * Return one or more meshes labeled by color for exporting.
   * MVP: STL export only; 3MF later.
   */
  getExportables?: (group: Group) => { label: string; color: string; object: Group }[]
}

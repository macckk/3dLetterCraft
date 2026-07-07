import type { Group } from 'three'
import type { TFunction } from 'i18next'

export type ControlValues = Record<string, string | number | boolean>

type BaseControl = {
  /**
   * If provided, the control is only rendered when this predicate returns true.
   * Used to hide dependent controls (e.g. base sizing when the base is disabled).
   */
  visibleWhen?: (values: ControlValues) => boolean
}

export type ControlType = BaseControl & (
  | { kind: 'text'; id: string; labelKey: string; default: string; maxLength?: number }
  | { kind: 'number'; id: string; labelKey: string; default: number; min: number; max: number; step: number; unit?: string }
  | { kind: 'color'; id: string; labelKey: string; default: string }
  | { kind: 'font'; id: string; labelKey: string; default: string; category?: 'block' | 'serif' | 'script' | 'sans' }
  | { kind: 'toggle'; id: string; labelKey: string; default: boolean }
)

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

export type ValidationSeverity = 'warning' | 'error'

export interface ValidationIssue {
  severity: ValidationSeverity
  messageKey: string
  params?: Record<string, string | number>
}

export interface TemplatePreset {
  id: string
  nameKey: string
  /** Partial values to overwrite; keys not listed are left as-is. */
  values: Partial<ControlValues>
}

export interface TemplateDefinition {
  id: string
  nameKey: string  // i18n key, e.g. "templates.nameWithScript.name"
  descriptionKey: string
  thumbnail?: string
  controls: ControlType[]
  presets?: TemplatePreset[]
  validate?: (values: ControlValues) => ValidationIssue[]
  build: (ctx: BuildContext) => Promise<Group> | Group
  /**
   * Return one or more meshes labeled by color for exporting.
   * MVP: STL export only; 3MF later.
   */
  getExportables?: (group: Group) => { label: string; color: string; object: Group }[]
}

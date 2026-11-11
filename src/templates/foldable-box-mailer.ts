import type { TemplateDefinition } from './types'
import { computeMailerBox } from '@/lib/geometry/boxTemplate'

export const foldableBoxMailerTemplate: TemplateDefinition = {
  id: 'foldable-box-mailer',
  nameKey: 'templates.foldableBoxMailer.name',
  descriptionKey: 'templates.foldableBoxMailer.description',
  type: 'svg',

  controls: [
    {
      kind: 'number',
      id: 'boxWidth',
      labelKey: 'controls.boxWidth',
      default: 150,
      min: 30,
      max: 500,
      step: 1,
      unit: 'mm',
    },
    {
      kind: 'number',
      id: 'boxDepth',
      labelKey: 'controls.boxDepth',
      default: 100,
      min: 20,
      max: 500,
      step: 1,
      unit: 'mm',
    },
    {
      kind: 'number',
      id: 'boxHeight',
      labelKey: 'controls.boxHeight',
      default: 50,
      min: 10,
      max: 300,
      step: 1,
      unit: 'mm',
    },
    {
      kind: 'number',
      id: 'materialThickness',
      labelKey: 'controls.materialThickness',
      default: 1.5,
      min: 0.5,
      max: 8,
      step: 0.5,
      unit: 'mm',
    },
  ],

  presets: [
    {
      id: 'small',
      nameKey: 'templates.foldableBoxMailer.presets.small',
      values: { boxWidth: 100, boxDepth: 70, boxHeight: 40, materialThickness: 1.5 },
    },
    {
      id: 'medium',
      nameKey: 'templates.foldableBoxMailer.presets.medium',
      values: { boxWidth: 200, boxDepth: 150, boxHeight: 80, materialThickness: 2 },
    },
    {
      id: 'large',
      nameKey: 'templates.foldableBoxMailer.presets.large',
      values: { boxWidth: 300, boxDepth: 200, boxHeight: 100, materialThickness: 3 },
    },
  ],

  buildSVG({ values }) {
    return computeMailerBox({
      width: Number(values.boxWidth),
      depth: Number(values.boxDepth),
      height: Number(values.boxHeight),
      thickness: Number(values.materialThickness),
    })
  },
}

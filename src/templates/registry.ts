import type { TemplateDefinition } from './types'
import { nameWithScriptTemplate } from './name-with-script'
import { coupleInitialsTemplate } from './couple-initials'
import { heartWithNameTemplate } from './heart-with-name'
import { cakeTopperTemplate } from './cake-topper'

// Adding a new template = import it here and push into the array.
export const templates: TemplateDefinition[] = [
  nameWithScriptTemplate,
  coupleInitialsTemplate,
  heartWithNameTemplate,
  cakeTopperTemplate,
]

export function getTemplate(id: string): TemplateDefinition | undefined {
  return templates.find((t) => t.id === id)
}

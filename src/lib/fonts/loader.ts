import opentype from 'opentype.js'
import type { Font } from 'opentype.js'

// Filename in /public/fonts/ per display name.
export const FONT_FILES: Record<string, string> = {
  'Cardo':      'Cardo.ttf',
  'Sacramento': 'Sacramento.ttf',
}

const cache = new Map<string, Promise<Font>>()

export async function loadFont(name: string): Promise<Font> {
  const file = FONT_FILES[name]
  if (!file) throw new Error(`Font not registered: ${name}`)

  let promise = cache.get(name)
  if (!promise) {
    const url = `${import.meta.env.BASE_URL}fonts/${file}`
    promise = (async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to load font ${name}: HTTP ${res.status}`)
      const buffer = await res.arrayBuffer()
      try {
        return opentype.parse(buffer)
      } catch (err) {
        throw new Error(
          `Failed to parse font ${name}: ${(err as Error).message}. ` +
          `Try a different font — this one uses OpenType features not supported by opentype.js.`
        )
      }
    })().catch((err) => {
      cache.delete(name)
      throw err
    })
    cache.set(name, promise)
  }
  return promise
}

import opentype from 'opentype.js'
import type { Font } from 'opentype.js'

// Filename in /public/fonts/ per display name.
export const FONT_FILES: Record<string, string> = {
  'Playfair Display': 'PlayfairDisplay.ttf',
  'Great Vibes':      'GreatVibes.ttf',
}

const cache = new Map<string, Promise<Font>>()

export async function loadFont(name: string): Promise<Font> {
  const file = FONT_FILES[name]
  if (!file) throw new Error(`Font not registered: ${name}`)

  let promise = cache.get(name)
  if (!promise) {
    const url = `${import.meta.env.BASE_URL}fonts/${file}`
    promise = opentype.load(url).catch((err) => {
      cache.delete(name)
      throw err
    })
    cache.set(name, promise)
  }
  return promise
}

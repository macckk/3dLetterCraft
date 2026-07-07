import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js'
import { Font } from 'three/examples/jsm/loaders/FontLoader.js'

// Filename in /public/fonts/ per display name.
export const FONT_FILES: Record<string, string> = {
  'Cardo':      'Cardo.ttf',
  'Sacramento': 'Sacramento.ttf',
}

const cache = new Map<string, Promise<Font>>()
const loader = new TTFLoader()

export async function loadFont(name: string): Promise<Font> {
  const file = FONT_FILES[name]
  if (!file) throw new Error(`Font not registered: ${name}`)

  let promise = cache.get(name)
  if (!promise) {
    const url = `${import.meta.env.BASE_URL}fonts/${file}`
    promise = new Promise<Font>((resolve, reject) => {
      loader.load(
        url,
        (json) => resolve(new Font(json)),
        undefined,
        (err) => {
          cache.delete(name)
          reject(err instanceof Error ? err : new Error(`Failed to load font ${name}`))
        }
      )
    })
    cache.set(name, promise)
  }
  return promise
}

export type { Font }

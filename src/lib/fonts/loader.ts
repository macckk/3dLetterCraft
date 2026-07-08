import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js'
import { Font } from 'three/examples/jsm/loaders/FontLoader.js'

// Filename in /public/fonts/ per display name.
export const FONT_FILES: Record<string, string> = {
  // Serif
  'Cardo':              'Cardo.ttf',
  'EB Garamond':        'EBGaramond.ttf',
  'PT Serif':           'PTSerif.ttf',
  'Alegreya':           'Alegreya.ttf',
  'Bitter':             'Bitter.ttf',
  'Lora':               'Lora.ttf',
  'Playfair Display':   'PlayfairDisplay.ttf',
  'Merriweather':       'Merriweather.ttf',
  'Cormorant Garamond': 'CormorantGaramond.ttf',
  'Libre Baskerville':  'LibreBaskerville.ttf',
  // Sans
  'Open Sans':          'OpenSans.ttf',
  'Montserrat':         'Montserrat.ttf',
  'Poppins':            'Poppins.ttf',
  'PT Sans':            'PTSans.ttf',
  'Bebas Neue':         'BebasNeue.ttf',
  'Roboto':             'Roboto.ttf',
  'Raleway':            'Raleway.ttf',
  'Oswald':             'Oswald.ttf',
  'Anton':              'Anton.ttf',
  'Nunito':             'Nunito.ttf',
  // Script
  'Sacramento':         'Sacramento.ttf',
  'Dancing Script':     'DancingScript.ttf',
  'Pacifico':           'Pacifico.ttf',
  'Kaushan Script':     'KaushanScript.ttf',
  'Allura':             'Allura.ttf',
  'Great Vibes':        'GreatVibes.ttf',
  'Satisfy':            'Satisfy.ttf',
  'Caveat':             'Caveat.ttf',
  'Yellowtail':         'Yellowtail.ttf',
  'Marck Script':       'MarckScript.ttf',
  // Display / block
  'Bangers':            'Bangers.ttf',
  'Fredoka':            'Fredoka.ttf',
  'Righteous':          'Righteous.ttf',
  'Alfa Slab One':      'AlfaSlabOne.ttf',
  'Bungee':             'Bungee.ttf',
}

const cache = new Map<string, Promise<Font>>()
const loader = new TTFLoader()

// ── Loading state — exposed so the UI can show "Baixando fontes..." while
// any TTF is still in flight. Any font that has ever resolved is considered
// cached and does not re-trigger the indicator.
let inFlight = 0
const listeners = new Set<(loading: boolean) => void>()

function notify() {
  const loading = inFlight > 0
  for (const fn of listeners) fn(loading)
}

export function isLoadingFonts(): boolean {
  return inFlight > 0
}

export function onFontLoadingChange(fn: (loading: boolean) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export async function loadFont(name: string): Promise<Font> {
  const file = FONT_FILES[name]
  if (!file) throw new Error(`Font not registered: ${name}`)

  let promise = cache.get(name)
  if (!promise) {
    const url = `${import.meta.env.BASE_URL}fonts/${file}`
    inFlight++
    notify()
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
    }).finally(() => {
      inFlight = Math.max(0, inFlight - 1)
      notify()
    })
    cache.set(name, promise)
  }
  return promise
}

export type { Font }

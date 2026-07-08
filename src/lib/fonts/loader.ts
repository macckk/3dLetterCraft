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

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import pt from './pt.json'
import en from './en.json'

const STORAGE_KEY = 'lettercraft:lang'

function detectInitial(): 'pt' | 'en' {
  const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  if (saved === 'pt' || saved === 'en') return saved
  const browser = typeof navigator !== 'undefined' ? navigator.language : ''
  return browser.toLowerCase().startsWith('pt') ? 'pt' : 'en'
}

void i18n.use(initReactI18next).init({
  resources: {
    pt: { translation: pt },
    en: { translation: en },
  },
  lng: detectInitial(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, lng)
})

export default i18n

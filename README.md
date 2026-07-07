# 3dLetterCraft

Design personalized 3D-printable name pieces in the browser.

Free, open-source, no login. Live at: **https://macckk.github.io/3dLetterCraft/**

## Features

- Fully parametric templates — text, fonts, colors, dimensions
- Live 3D preview (Three.js)
- Bilingual: PT-BR and EN
- STL export for 3D printing
- Designs auto-saved in `localStorage`
- Plugin architecture for adding new templates

## Design principles

- **Multi-color pieces:** every template that stacks parts exposes a `tolerance` control (default 0.2 mm per side). Pockets are inflated by this amount so pieces snap together despite 3D-printer accuracy.
- **Two export modes:** each color exports as a separate STL. In the future, `.3mf` with per-body color will support multi-material printers directly.

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · Three.js (`@react-three/fiber` + `drei`) · Zustand · i18next · opentype.js

## Development

```bash
npm install
npm run dev       # dev server
npm run build     # production build → dist/
npm run preview   # preview built app
```

## Adding a new template

1. Create `src/templates/<my-template>.ts` implementing `TemplateDefinition`
2. Register it in `src/templates/registry.ts`
3. Add i18n keys to `src/i18n/pt.json` and `src/i18n/en.json`

See [name-with-script.ts](src/templates/name-with-script.ts) as reference.

## Deploy

Automatic on push to `main` via GitHub Actions → Pages.

## License

MIT

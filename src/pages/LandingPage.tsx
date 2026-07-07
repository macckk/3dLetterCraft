import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { templates } from '@/templates/registry'
import { TemplateIcon } from '@/components/TemplateIcon'

export function LandingPage() {
  const { t } = useTranslation()

  return (
    <main className="flex-1 overflow-y-auto">
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            {t('landing.headline')}
          </h2>
          <p className="mt-3 text-neutral-400 max-w-2xl mx-auto">
            {t('landing.subhead')}
          </p>
        </div>

        <div className="mb-4 text-xs uppercase tracking-wider text-neutral-500">
          {t('landing.chooseTemplate')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <Link
              key={tpl.id}
              to={`/editor/${tpl.id}`}
              className="group flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800/70 hover:border-indigo-500 transition-colors p-4"
            >
              <div className="aspect-[4/3] rounded bg-gradient-to-br from-neutral-800 to-neutral-950 border border-neutral-800 overflow-hidden">
                <TemplateIcon id={tpl.id} />
              </div>
              <div className="text-sm font-medium text-neutral-100 group-hover:text-white">
                {t(tpl.nameKey)}
              </div>
              <div className="text-xs text-neutral-400">
                {t(tpl.descriptionKey)}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center text-sm text-neutral-400 flex flex-col items-center gap-3">
          <span>{t('landing.footer')}</span>
          <a
            href="https://www.instagram.com/marcelocuin"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-neutral-300 hover:text-pink-400 transition-colors"
            aria-label="Instagram @marcelocuin"
          >
            <InstagramIcon />
            <span>@marcelocuin</span>
          </a>
        </div>
      </section>
    </main>
  )
}

function InstagramIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x={2} y={2} width={20} height={20} rx={5} ry={5} />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1={17.5} y1={6.5} x2={17.51} y2={6.5} />
    </svg>
  )
}

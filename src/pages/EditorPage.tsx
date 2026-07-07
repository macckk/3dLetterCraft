import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Viewer3D } from '@/components/Viewer3D'
import { ControlPanel } from '@/components/ControlPanel'
import { getTemplate } from '@/templates/registry'
import { useDesignStore } from '@/store/design'

export function EditorPage() {
  const { templateId = '' } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const currentId = useDesignStore((s) => s.templateId)
  const setTemplate = useDesignStore((s) => s.setTemplate)

  useEffect(() => {
    if (!getTemplate(templateId)) {
      navigate('/', { replace: true })
      return
    }
    if (templateId !== currentId) setTemplate(templateId)
  }, [templateId, currentId, setTemplate, navigate])

  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] overflow-hidden">
      <aside className="border-r border-neutral-800 bg-neutral-900">
        <ControlPanel />
      </aside>
      <main className="min-w-0">
        <Viewer3D />
      </main>
    </div>
  )
}

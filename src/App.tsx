import { Viewer3D } from '@/components/Viewer3D'
import { ControlPanel } from '@/components/ControlPanel'
import { TopBar } from '@/components/TopBar'

function App() {
  return (
    <div className="h-full flex flex-col bg-neutral-950 text-neutral-100">
      <TopBar />
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] overflow-hidden">
        <aside className="border-r border-neutral-800 bg-neutral-900">
          <ControlPanel />
        </aside>
        <main className="min-w-0">
          <Viewer3D />
        </main>
      </div>
    </div>
  )
}

export default App

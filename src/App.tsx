import { HashRouter, Route, Routes } from 'react-router-dom'
import { TopBar } from '@/components/TopBar'
import { LandingPage } from '@/pages/LandingPage'
import { EditorPage } from '@/pages/EditorPage'

function App() {
  return (
    <HashRouter>
      <div className="h-full flex flex-col bg-neutral-950 text-neutral-100">
        <TopBar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/editor/:templateId" element={<EditorPage />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </div>
    </HashRouter>
  )
}

export default App

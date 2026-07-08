import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Grid, Html } from '@react-three/drei'
import type { Group } from 'three'
import { getTemplate } from '@/templates/registry'
import { useDesignStore } from '@/store/design'
import { useTranslation } from 'react-i18next'
import { isLoadingFonts, onFontLoadingChange } from '@/lib/fonts/loader'

export function Viewer3D() {
  const templateId = useDesignStore((s) => s.templateId)
  const values = useDesignStore((s) => s.values)
  const { t } = useTranslation()

  const [group, setGroup] = useState<Group | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fontsLoading, setFontsLoading] = useState<boolean>(isLoadingFonts())

  useEffect(() => onFontLoadingChange(setFontsLoading), [])

  useEffect(() => {
    const tpl = getTemplate(templateId)
    if (!tpl) return
    let cancelled = false
    setLoading(true)
    setError(null)
    // Debounce so dragging sliders doesn't spam rebuilds.
    const timer = window.setTimeout(() => {
      Promise.resolve(tpl.build({ values, t, mode: 'preview' }))
        .then((g) => { if (!cancelled) setGroup(g) })
        .catch((err) => { if (!cancelled) setError(String(err?.message ?? err)) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [templateId, values, t])

  return (
    <div className="relative w-full h-full">
      <Canvas
        shadows
        camera={{ position: [220, 180, 320], fov: 45 }}
        className="w-full h-full"
      >
        <color attach="background" args={['#0f1115']} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[300, 400, 250]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <Suspense fallback={<Html center>Loading…</Html>}>
          {group && <primitive object={group} />}
          <Environment preset="city" />
        </Suspense>
        <Grid
          position={[0, -0.5, 0]}
          args={[1200, 1200]}
          cellColor="#232732"
          sectionColor="#323848"
          sectionThickness={1}
          cellThickness={0.5}
          cellSize={10}
          sectionSize={100}
          fadeDistance={900}
          fadeStrength={2}
          infiniteGrid
        />
        <OrbitControls makeDefault target={[0, 80, 0]} />
      </Canvas>

      {(loading || fontsLoading) && (
        <div className="absolute top-3 left-3 text-xs text-neutral-200 bg-neutral-900/85 rounded px-3 py-1.5 flex items-center gap-2 shadow-lg border border-neutral-700">
          <span className="inline-block w-3 h-3 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
          <span>{fontsLoading ? t('status.loadingFonts') : t('status.rendering')}</span>
        </div>
      )}
      {error && (
        <div className="absolute top-3 left-3 text-xs text-red-300 bg-red-900/60 rounded px-2 py-1 max-w-md">
          {error}
        </div>
      )}
    </div>
  )
}

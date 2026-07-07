import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Grid, Html } from '@react-three/drei'
import type { Group } from 'three'
import { getTemplate } from '@/templates/registry'
import { useDesignStore } from '@/store/design'
import { useTranslation } from 'react-i18next'

export function Viewer3D() {
  const templateId = useDesignStore((s) => s.templateId)
  const values = useDesignStore((s) => s.values)
  const { t } = useTranslation()

  const [group, setGroup] = useState<Group | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const tpl = getTemplate(templateId)
    if (!tpl) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.resolve(tpl.build({ values, t }))
      .then((g) => { if (!cancelled) setGroup(g) })
      .catch((err) => { if (!cancelled) setError(String(err?.message ?? err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
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
          position={[0, -0.01, 0]}
          args={[800, 800]}
          cellColor="#2a2f3a"
          sectionColor="#3a4152"
          sectionThickness={1}
          cellThickness={0.5}
          fadeDistance={700}
          infiniteGrid
        />
        <OrbitControls makeDefault target={[0, 60, 0]} />
      </Canvas>

      {loading && (
        <div className="absolute top-3 left-3 text-xs text-neutral-400 bg-neutral-900/80 rounded px-2 py-1">
          …
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

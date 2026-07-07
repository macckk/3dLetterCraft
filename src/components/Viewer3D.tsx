import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Grid } from '@react-three/drei'
import type { Group } from 'three'
import { getTemplate } from '@/templates/registry'
import { useDesignStore } from '@/store/design'
import { useTranslation } from 'react-i18next'

function TemplateMesh({ group }: { group: Group }) {
  return <primitive object={group} />
}

export function Viewer3D() {
  const templateId = useDesignStore((s) => s.templateId)
  const values = useDesignStore((s) => s.values)
  const { t } = useTranslation()

  const group = useMemo(() => {
    const tpl = getTemplate(templateId)
    if (!tpl) return null
    const result = tpl.build({ values, t })
    // build may be async in the future — placeholder is sync
    return result as Group
  }, [templateId, values, t])

  return (
    <Canvas
      shadows
      camera={{ position: [180, 120, 260], fov: 45 }}
      className="w-full h-full"
    >
      <color attach="background" args={['#0f1115']} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[200, 300, 200]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <Suspense fallback={null}>
        {group && <TemplateMesh group={group} />}
        <Environment preset="city" />
      </Suspense>
      <Grid
        position={[0, -0.01, 0]}
        args={[600, 600]}
        cellColor="#2a2f3a"
        sectionColor="#3a4152"
        sectionThickness={1}
        cellThickness={0.5}
        fadeDistance={500}
      />
      <OrbitControls makeDefault target={[0, 60, 0]} />
    </Canvas>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { NootState } from '../lib/noot/scene'
import { NootRig } from './NootRig'

export function Noot3D(props: NootState) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const state = useRef(props)
  const scene = useRef<{ wake(): void; dispose(): void } | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => { state.current = props; scene.current?.wake() }, [props])
  useEffect(() => {
    let cancelled = false
    import('../lib/noot/scene').then(({ mountNoot }) => {
      if (cancelled || !canvasRef.current) return
      try {
        scene.current = mountNoot(canvasRef.current, () => state.current, value => {
          if (!cancelled) setReady(previous => previous === value ? previous : value)
        })
      } catch (error) {
        // SVG preserves the game on devices without WebGL.
        console.warn('Noot 3D unavailable; using vector fallback.', error)
      }
    }).catch(error => console.warn('Noot 3D could not load; using vector fallback.', error))
    return () => { cancelled = true; scene.current?.dispose(); scene.current = null }
  }, [])
  return (
    <>
      {!ready && <NootRig />}
      <canvas ref={canvasRef} className="noot-canvas" style={{ opacity: ready ? 1 : 0 }} aria-hidden="true" />
    </>
  )
}

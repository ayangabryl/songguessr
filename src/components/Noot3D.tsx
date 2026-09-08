import {useNootPreferences} from '../lib/noot/preferences'
import { useEffect, useRef, useState } from 'react'
import { mountNoot, type NootState } from '../lib/noot/scene'
import '../noot-loading.css'

export function Noot3D(props: NootState) {
  const [appearance]=useNootPreferences()
  const resolvedProps={...appearance,...props}
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const state = useRef(resolvedProps)
  const scene = useRef<{ wake(): void; dispose(): void } | null>(null)
  const [fallback, setFallback] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    state.current = resolvedProps
    scene.current?.wake()
  })
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      scene.current = mountNoot(canvas, () => state.current, (ready) => {
        setFallback(!ready)
      }, () => setFailed(true))
    } catch (error) {
      setFailed(true)
      console.warn('Noot 3D unavailable.', error)
    }
    return () => {
      scene.current?.dispose()
      scene.current = null
    }
  }, [])
  return (
    <>
      {fallback && <span className="noot-load-state" role="status">{failed ? <span className="noot-load-error">3D unavailable</span> : <><span className="noot-load-dot" aria-hidden="true" /><span className="sr-only">Loading 3D Noot</span></>}</span>}
      <canvas ref={canvasRef} className="noot-canvas" style={{ opacity: fallback ? 0 : 1 }} aria-hidden="true" />
    </>
  )
}

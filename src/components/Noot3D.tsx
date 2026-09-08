import {useNootPreferences} from '../lib/noot/preferences'
import { useEffect, useRef, useState } from 'react'
import { mountNoot, type NootState } from '../lib/noot/scene'
import { NootRig } from './NootRig'

export function Noot3D(props: NootState) {
  const [appearance]=useNootPreferences()
  const resolvedProps={...appearance,...props}
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const state = useRef(resolvedProps)
  const scene = useRef<{ wake(): void; dispose(): void } | null>(null)
  const [fallback, setFallback] = useState(true)
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
      })
    } catch (error) {
      console.warn('Noot 3D unavailable; using vector fallback.', error)
      // The initial vector remains visible if WebGL creation fails.
    }
    return () => {
      scene.current?.dispose()
      scene.current = null
    }
  }, [])
  return (
    <>
      {fallback ? <NootRig /> : null}
      <canvas ref={canvasRef} className="noot-canvas" hidden={fallback} aria-hidden="true" />
    </>
  )
}

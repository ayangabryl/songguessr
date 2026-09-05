import { useEffect, useRef, useState } from 'react'
import { mountNoot, type NootState } from '../lib/noot/scene'
import { NootRig } from './NootRig'

export function Noot3D(props: NootState) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const state = useRef(props)
  const scene = useRef<{ wake(): void; dispose(): void } | null>(null)
  const [fallback, setFallback] = useState(false)
  useEffect(() => {
    state.current = props
    scene.current?.wake()
  }, [props])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      scene.current = mountNoot(canvas, () => state.current, (ready) => {
        if (!ready) setFallback(true)
      })
    } catch (error) {
      console.warn('Noot 3D unavailable; using vector fallback.', error)
      setFallback(true)
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

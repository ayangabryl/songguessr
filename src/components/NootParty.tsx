import type { NootLiveChannel } from '../lib/noot/live-channel'
import { useEffect, useRef, useState } from 'react'
import { mountNootParty } from '../lib/noot/party-scene'
import type { NootParticipant, PlayKind, GroupKind } from '../lib/noot/social-world'
import '../noot-loading.css'
import '../noot-party.css'

export interface PartyCommand { id: number; action: PlayKind | GroupKind | 'jump' | 'lift' | 'drop'; actor: string; friend?: string }
export function NootParty({ participants, theme, paused, speed, command, onChoose, labelAction, network }: {
  participants: NootParticipant[]; theme: 'light' | 'dark'; paused?: boolean; speed?: number
  network?: NootLiveChannel
  command?: PartyCommand; onChoose?: (id: string) => void; labelAction?: (id: string) => string
}) {
  const canvas = useRef<HTMLCanvasElement>(null), controller = useRef<ReturnType<typeof mountNootParty> | null>(null)
  const input = useRef({ participants, theme, paused, speed, network }), choose = useRef(onChoose)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0)
  const labels = useRef(new Map<string, HTMLSpanElement>())
  useEffect(() => { input.current = { participants, theme, paused, speed, network }; choose.current = onChoose; controller.current?.wake() })
  useEffect(() => {
    if (!canvas.current) return
    setReady(false); setFailed(false)
    try { controller.current = mountNootParty(canvas.current, () => input.current, setReady, id => choose.current?.(id), (id, x, y) => {
      const label = labels.current.get(id)
      if (label) label.style.transform = `translate(${x}px,${y}px) translateX(-50%)`
      return Boolean(label)
    }, () => setFailed(true)) }
    catch (error) { setFailed(true); console.warn('Noot shared stage unavailable', error) }
    return () => { controller.current?.dispose(); controller.current = null }
  }, [attempt])
  useEffect(() => network?.subscribe(event => controller.current?.receive(event)), [network, attempt])
  useEffect(() => {
    if (!command || !controller.current || !ready) return
    if (command.action === 'lift') controller.current.lift(command.actor)
    else if (command.action === 'drop') controller.current.drop(command.actor)
    else if (command.action === 'jump') controller.current.jump(command.actor)
    else if (command.action === 'wave-chain' || command.action === 'group-dance') controller.current.groupInteract(command.action)
    else if (command.friend) controller.current.interact(command.actor, command.friend, command.action)
  }, [command, ready])
  return <div className="noot-shared-world" aria-busy={!ready && !failed}>
    {!ready && <div className="noot-load-state" role="status">{failed
      ? <button type="button" onClick={() => setAttempt(n => n + 1)}>Reload 3D Noots</button>
      : <><span className="noot-load-dot" aria-hidden="true" /><span className="sr-only">Loading 3D Noots</span></>}</div>}
    <canvas ref={canvas} className="noot-party-canvas" style={{ opacity: ready ? 1 : 0 }} tabIndex={ready ? 0 : -1} role="group" aria-hidden={!ready} aria-label="Noot playground. Arrows choose a friend. Space jumps. Enter waves. Drag and release to pick up and drop." />
    <div className="noot-world-labels" style={{ opacity: ready ? 1 : 0 }} aria-hidden={labelAction ? !ready : true}>{participants.map(p => <span key={p.id} style={{ maxWidth: `min(130px, ${92 / Math.max(2, participants.length)}%)` }} ref={element => { if (element) labels.current.set(p.id, element); else labels.current.delete(p.id) }}>{labelAction ? <button type="button" tabIndex={ready ? 0 : -1} title={p.name} aria-label={labelAction(p.id)} onClick={() => onChoose?.(p.id)}>{p.name}</button> : p.name}</span>)}</div>
  </div>
}

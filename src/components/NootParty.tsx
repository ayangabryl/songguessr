import { useEffect, useRef, useState } from 'react'
import { mountNootParty } from '../lib/noot/party-scene'
import type { NootParticipant, PlayKind, GroupKind } from '../lib/noot/social-world'
import { NootRig } from './NootRig'
import '../noot-party.css'

export interface PartyCommand { id: number; action: PlayKind | GroupKind | 'jump' | 'lift' | 'drop'; actor: string; friend?: string }
export function NootParty({ participants, theme, paused, speed, command, onChoose }: {
  participants: NootParticipant[]; theme: 'light' | 'dark'; paused?: boolean; speed?: number
  command?: PartyCommand; onChoose?: (id: string) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null), controller = useRef<ReturnType<typeof mountNootParty> | null>(null)
  const input = useRef({ participants, theme, paused, speed }), choose = useRef(onChoose)
  const [ready, setReady] = useState(false)
  const labels = useRef(new Map<string, HTMLSpanElement>())
  useEffect(() => { input.current = { participants, theme, paused, speed }; choose.current = onChoose; controller.current?.wake() })
  useEffect(() => {
    if (!canvas.current) return
    try { controller.current = mountNootParty(canvas.current, () => input.current, setReady, id => choose.current?.(id), (id, x, y) => {
      const label = labels.current.get(id)
      if (label) label.style.transform = `translate(${x}px,${y}px) translateX(-50%)`
    }) }
    catch (error) { console.warn('Noot shared stage unavailable', error) }
    return () => { controller.current?.dispose(); controller.current = null }
  }, [])
  useEffect(() => {
    if (!command || !controller.current || !ready) return
    if (command.action === 'lift') controller.current.lift(command.actor)
    else if (command.action === 'drop') controller.current.drop(command.actor)
    else if (command.action === 'jump') controller.current.jump(command.actor)
    else if (command.action === 'wave-chain' || command.action === 'group-dance') controller.current.groupInteract(command.action)
    else if (command.friend) controller.current.interact(command.actor, command.friend, command.action)
  }, [command, ready])
  return <div className="noot-shared-world">
    {!ready && <div className="noot-party-fallback" aria-hidden="true">{participants.map(p => <div className="mascot" key={p.id}><NootRig /></div>)}</div>}
    <canvas ref={canvas} className="noot-party-canvas" hidden={!ready} tabIndex={0} role="group" aria-label="Noot playground. Arrows choose a friend. Space jumps. Enter waves. Drag and release to pick up and drop." />
    {ready && <div className="noot-world-labels" aria-hidden="true">{participants.map(p => <span key={p.id} ref={element => { if (element) labels.current.set(p.id, element); else labels.current.delete(p.id) }}>{p.name}</span>)}</div>}
  </div>
}

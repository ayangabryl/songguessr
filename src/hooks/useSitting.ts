import { createNootLiveChannel } from '../lib/noot/live-channel'
import type { NootLiveEvent } from '../../shared/noot-live'
import { createSittingConnection } from '../lib/sitting-connection'
import {useNootPreferences} from '../lib/noot/preferences'
import { loadNootAsset } from '../lib/noot/asset'
import { parseAppearance } from '../../shared/noot-profile'
import type { MatchView, MatchCommand } from '../../shared/match'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  filterPlayers,
  normalizeSittingCode,
  parseSittingName,
  sittingErrorMessage,
  type RankedPlayer,
  type SittingError,
} from '../../shared/sitting'
import {
  filterRecentSitters,
  loadDisplayName,
  loadLastSittingCode,
  loadPlayerId,
  loadRecentSitters,
  rememberSitters,
  saveDisplayName,
  saveLastSittingCode,
  type RecentSitter,
} from '../lib/player'
import {
  createSitting,
  isSittingWireError,
  peekSitting,
  sittingSocketUrl,
} from '../lib/sitting-api'

export type SittingStatus = 'solo' | 'connecting' | 'live' | 'error'
export type SittingPending = 'host' | 'join' | null

interface StatePayload {
  type: 'state'
  match?: MatchView|null
  serverNow?:number
  code: string
  hostId: string | null
  players: RankedPlayer[]
}

interface ErrorPayload {
  type: 'error'
  error: SittingError
  message: string
}

function inviteCodeFromUrl(): string | null {
  try {
    return normalizeSittingCode(new URLSearchParams(location.search).get('sit') ?? '')
  } catch {
    return null
  }
}

export function useSitting() {
  const playerId = useMemo(() => loadPlayerId(), [])
  const [match,setMatch] = useState<MatchView|null>(null)
  const [matchError,setMatchError] = useState<string|null>(null)
  const [clockOffset,setClockOffset] = useState(0)
  const [status, setStatus] = useState<SittingStatus>('solo')
  const [code, setCode] = useState<string | null>(null)
  const [hostId, setHostId] = useState<string | null>(null)
  const [players, setPlayers] = useState<RankedPlayer[]>([])
  const [error, setError] = useState<SittingError | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [appearance]=useNootPreferences()
  const appearanceRef = useRef(appearance)
  appearanceRef.current = appearance
  const [name, setName] = useState(loadDisplayName)
  const [query, setQuery] = useState('')
  const [joinCode, setJoinCode] = useState(() => inviteCodeFromUrl() ?? '')
  const [friends, setFriends] = useState<RecentSitter[]>(loadRecentSitters)
  const [slow, setSlow] = useState(false)
  const [pending, setPending] = useState<SittingPending>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const nootChannel = useMemo(() => createNootLiveChannel(packet => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(packet))
  }, playerId), [playerId])
  const sentProfileRef = useRef('')
  const leaveRef = useRef(false)
  const connectionRef = useRef<ReturnType<typeof createSittingConnection> | null>(null)
  const requestRef = useRef(0)
  const targetCodeRef = useRef<string | null>(null)
  const statusRef = useRef(status)
  statusRef.current = status

  const fail = useCallback((next: SittingError, text?: string) => {
    setStatus('error')
    setError(next)
    setMessage(text ?? sittingErrorMessage(next))
    setSlow(false)
    setPending(null)
  }, [])

  const applyBoard = useCallback(
    (payload: StatePayload) => {
      setMatch(payload.match??null)
      setMatchError(null)
      setClockOffset((payload.serverNow??Date.now())-Date.now())
      setCode(payload.code)
      setHostId(payload.hostId)
      setPlayers(payload.players)
      setStatus('live')
      setError(null)
      setMessage(null)
      setSlow(false)
      setPending(null)
      saveLastSittingCode(payload.code)
      rememberSitters(
        payload.players.map((player) => player.name),
        payload.code,
        name,
      )
      setFriends(loadRecentSitters())
    },
    [name],
  )

  const disconnectSocket = useCallback(() => {
    connectionRef.current?.dispose()
    connectionRef.current = null
    socketRef.current = null
  }, [])

  const connect = useCallback((nextCode: string, openingPoints: number) => {
    const parsedName = parseSittingName(name)
    if (!parsedName.ok) { fail(parsedName.error); return }
    saveDisplayName(parsedName.name); setName(parsedName.name)
    leaveRef.current = false; targetCodeRef.current = nextCode
    disconnectSocket()
    void loadNootAsset().catch(() => {})
    sentProfileRef.current = ''
    connectionRef.current = createSittingConnection({
      url: sittingSocketUrl(nextCode, playerId, parsedName.name, openingPoints),
      onSocket: socket => { socketRef.current = socket; if (!socket) nootChannel.reset() },
      onOpen: socket => {
        const profile = JSON.stringify({ type: 'pet-profile', appearance: parseAppearance(appearanceRef.current), name: parsedName.name })
        socket.send(profile); sentProfileRef.current = profile
      },
      onConnecting: () => { setStatus('connecting'); setSlow(false); setError(null); setMessage(null) },
      onSlow: () => setSlow(true),
      onFailure: reason => {
        if (reason === 'replaced') fail('server', 'This table is open in another tab. Reconnect here to switch back.')
        else fail(reason)
      },
      onPayload: payload => {
        if (payload.type === 'pet-motion' || payload.type === 'pet-social') { nootChannel.receive(payload as unknown as NootLiveEvent); return }
        if (payload.type === 'state') applyBoard(payload as unknown as StatePayload)
        else if (payload.type === 'match-error') setMatchError(String(payload.message))
        else if (payload.type === 'error') fail((payload as unknown as ErrorPayload).error, String(payload.message))
      },
    })
  }, [applyBoard, disconnectSocket, fail, name, playerId, nootChannel])

  const host = useCallback(
    async (openingPoints: number) => {
      if (!navigator.onLine) {
        fail('offline')
        return
      }
      const parsedName = parseSittingName(name)
      if (!parsedName.ok) {
        fail(parsedName.error)
        return
      }
      setStatus('connecting')
      setSlow(false)
      setPending('host')
      const request = ++requestRef.current
      void loadNootAsset().catch(() => {})
      try {
        const created = await createSitting()
        if (request !== requestRef.current) return
        connect(created.code, openingPoints)
      } catch (caught) {
        if (request !== requestRef.current) return
        if (caught instanceof DOMException && caught.name === 'TimeoutError') {
          fail('timeout')
          return
        }
        if (isSittingWireError(caught)) {
          fail(caught.error, caught.message)
          return
        }
        fail(navigator.onLine ? 'server' : 'offline')
      }
    },
    [connect, fail, name],
  )

  const join = useCallback(
    async (rawCode: string, openingPoints: number) => {
      if (!navigator.onLine) {
        fail('offline')
        return
      }
      const parsedName = parseSittingName(name)
      if (!parsedName.ok) {
        fail(parsedName.error)
        return
      }
      const normalized = normalizeSittingCode(rawCode)
      if (!normalized) {
        fail('bad-code')
        return
      }
      setJoinCode(normalized)
      setStatus('connecting')
      setPending('join')
      const request = ++requestRef.current
      void loadNootAsset().catch(() => {})
      try {
        const peek = await peekSitting(normalized, playerId)
        if (request !== requestRef.current) return
        if (peek.full) {
          fail('room-full')
          return
        }
        connect(normalized, openingPoints)
      } catch (caught) {
        if (request !== requestRef.current) return
        if (caught instanceof DOMException && caught.name === 'TimeoutError') {
          fail('timeout')
          return
        }
        if (isSittingWireError(caught)) {
          fail(caught.error, caught.message)
          return
        }
        fail(navigator.onLine ? 'server' : 'offline')
      }
    },
    [connect, fail, name, playerId],
  )

  const leave = useCallback(() => {
    leaveRef.current = true
    requestRef.current++; targetCodeRef.current = null
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'leave' }))
    }
    disconnectSocket()
    saveLastSittingCode(null)
    setMatch(null);setMatchError(null)
    setStatus('solo')
    setCode(null)
    setHostId(null)
    setPlayers([])
    setError(null)
    setMessage(null)
    setSlow(false)
    setPending(null)
  }, [disconnectSocket])

  useEffect(() => {
    if (status !== 'live' || socketRef.current?.readyState !== WebSocket.OPEN) return
    // Keep local fitting instant while coalescing custom-color picker scrubbing.
    const socket = socketRef.current
    const timer = window.setTimeout(() => {
      const profile = JSON.stringify({ type: 'pet-profile', appearance: parseAppearance(appearanceRef.current), name })
      if (socketRef.current === socket && socket.readyState === WebSocket.OPEN && profile !== sentProfileRef.current) {
        socket.send(profile); sentProfileRef.current = profile
      }
    }, 120)
    return () => window.clearTimeout(timer)
  }, [appearance, status, name])
  useEffect(()=>{const update=()=>setName(loadDisplayName());window.addEventListener('songguessr-profile',update);return()=>window.removeEventListener('songguessr-profile',update)},[])
  const greet=useCallback((target:string)=>{if(socketRef.current?.readyState===WebSocket.OPEN)socketRef.current.send(JSON.stringify({type:'pet-greet',target}))},[])
  const sendMatch = useCallback((command:MatchCommand) => {
    if(socketRef.current?.readyState!==WebSocket.OPEN) {setMatchError('Reconnecting. Your progress is saved.');return}
    setMatchError(null);socketRef.current.send(JSON.stringify(command))
  },[])
  const reportActivity = useCallback((action: 'skip'|'listening'|'solved'|'missed'|'idle', stage: number) => {
    if(socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({type:'activity',action,stage}))
  }, [])

  const reportScore = useCallback((delta: number) => {
    if (statusRef.current !== 'live') return
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'score', delta }))
  }, [])

  useEffect(() => {
    const invite = inviteCodeFromUrl()
    if (invite) setJoinCode(invite)
    else {
      const last = loadLastSittingCode()
      if (last) setJoinCode(last)
    }
    return () => {
      leaveRef.current = true
      requestRef.current++
      disconnectSocket()
    }
  }, [disconnectSocket])

  useEffect(() => {
    const resume = () => { if (!leaveRef.current) connectionRef.current?.resume() }
    const offline = () => connectionRef.current?.offline()
    const visible = () => { if (!document.hidden) resume() }
    window.addEventListener('online', resume)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('online', resume)
      window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])

  useEffect(() => {
    if (status !== 'live') return
    const pulse = () => {
      if (!document.hidden && socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({type:'pet-pulse'}))
    }
    const timer = window.setInterval(pulse, 15000)
    return () => window.clearInterval(timer)
  }, [status])

  const visiblePlayers = useMemo(() => filterPlayers(players, query), [players, query])
  const visibleFriends = useMemo(() => filterRecentSitters(friends, query), [friends, query])
  const inviteUrl = code ? `${location.origin}/?sit=${code}` : null
  const you = players.find((player) => player.id === playerId) ?? null

  return {
    playerId,
    nootChannel: status === 'solo' ? undefined : nootChannel,
    match,matchError,clockOffset,sendMatch,greet,
    status,
    code,
    hostId,
    players,
    visiblePlayers,
    you,
    error,
    message,
    name,
    setName,
    query,
    setQuery,
    joinCode,
    setJoinCode,
    friends: visibleFriends,
    slow,
    pending,
    inviteUrl,
    inviteCode: inviteCodeFromUrl(),
    host,
    join,
    leave,
    reconnect:()=>{const target = targetCodeRef.current ?? code; if(target)connect(target,0)},
    reportScore,
    reportActivity,
    live: status === 'live',
  }
}

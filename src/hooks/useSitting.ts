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
  const [status, setStatus] = useState<SittingStatus>('solo')
  const [code, setCode] = useState<string | null>(null)
  const [hostId, setHostId] = useState<string | null>(null)
  const [players, setPlayers] = useState<RankedPlayer[]>([])
  const [error, setError] = useState<SittingError | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [name, setName] = useState(loadDisplayName)
  const [query, setQuery] = useState('')
  const [joinCode, setJoinCode] = useState(() => inviteCodeFromUrl() ?? '')
  const [friends, setFriends] = useState<RecentSitter[]>(loadRecentSitters)
  const [slow, setSlow] = useState(false)
  const [pending, setPending] = useState<SittingPending>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const leaveRef = useRef(false)
  const retryRef = useRef(0)
  const connectRef = useRef<(nextCode: string, openingPoints: number) => void>(() => {})
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
      setCode(payload.code)
      setHostId(payload.hostId)
      setPlayers(payload.players)
      setStatus('live')
      setError(null)
      setMessage(null)
      setSlow(false)
      retryRef.current = 0
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
    const socket = socketRef.current
    socketRef.current = null
    if (!socket) return
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(1000, 'client')
    }
  }, [])

  const connect = useCallback(
    (nextCode: string, openingPoints: number) => {
      const parsedName = parseSittingName(name)
      if (!parsedName.ok) {
        fail(parsedName.error)
        return
      }
      saveDisplayName(parsedName.name)
      setName(parsedName.name)
      leaveRef.current = false
      setStatus('connecting')
      setSlow(false)
      disconnectSocket()
      const socket = new WebSocket(sittingSocketUrl(nextCode, playerId, parsedName.name, openingPoints))
      socketRef.current = socket
      const slowTimer = window.setTimeout(() => setSlow(true), 1000)
      const timeout = window.setTimeout(() => {
        if (socketRef.current === socket && statusRef.current === 'connecting') {
          disconnectSocket()
          fail('timeout')
        }
      }, 8000)

      socket.onmessage = (event) => {
        window.clearTimeout(slowTimer)
        window.clearTimeout(timeout)
        let payload: StatePayload | ErrorPayload | null = null
        try {
          payload = JSON.parse(String(event.data)) as StatePayload | ErrorPayload
        } catch {
          return
        }
        if (payload.type === 'state') {
          applyBoard(payload)
          return
        }
        if (payload.type === 'error') fail(payload.error, payload.message)
      }
      socket.onerror = () => {
        /* onclose handles retry */
      }
      socket.onclose = () => {
        window.clearTimeout(slowTimer)
        window.clearTimeout(timeout)
        if (socketRef.current === socket) socketRef.current = null
        if (leaveRef.current) return
        if (statusRef.current === 'connecting') {
          fail(navigator.onLine ? 'server' : 'offline')
          return
        }
        if (statusRef.current !== 'live') return
        const delay = Math.min(8000, 500 * 2 ** retryRef.current)
        retryRef.current += 1
        window.setTimeout(() => {
          if (leaveRef.current || statusRef.current === 'solo') return
          connectRef.current(nextCode, 0)
        }, delay)
      }
    },
    [applyBoard, disconnectSocket, fail, name, playerId],
  )

  connectRef.current = connect

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
      try {
        const created = await createSitting()
        connect(created.code, openingPoints)
      } catch (caught) {
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
      try {
        const peek = await peekSitting(normalized, playerId)
        if (peek.full) {
          fail('room-full')
          return
        }
        connect(normalized, openingPoints)
      } catch (caught) {
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
    retryRef.current = 0
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'leave' }))
    }
    disconnectSocket()
    saveLastSittingCode(null)
    setStatus('solo')
    setCode(null)
    setHostId(null)
    setPlayers([])
    setError(null)
    setMessage(null)
    setSlow(false)
    setPending(null)
  }, [disconnectSocket])

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
      disconnectSocket()
    }
  }, [disconnectSocket])

  const visiblePlayers = useMemo(() => filterPlayers(players, query), [players, query])
  const visibleFriends = useMemo(() => filterRecentSitters(friends, query), [friends, query])
  const inviteUrl = code ? `${location.origin}/?sit=${code}` : null
  const you = players.find((player) => player.id === playerId) ?? null

  return {
    playerId,
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
    reportScore,
    live: status === 'live',
  }
}

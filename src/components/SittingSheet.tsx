import { type FormEvent, type ReactNode } from 'react'
import { parseSittingName, sittingErrorMessage, normalizeSittingCode } from '../../shared/sitting'
import { filterRecentSitters, type RecentSitter } from '../lib/player'
import type { SittingPending, SittingStatus } from '../hooks/useSitting'
import { SettingsSheet } from './SettingsSheet'

interface SittingSheetProps {
  open: boolean
  onClose: () => void
  name: string
  onName: (value: string) => void
  joinCode: string
  onJoinCode: (value: string) => void
  query: string
  onQuery: (value: string) => void
  status: SittingStatus
  code: string | null
  inviteUrl: string | null
  message: string | null
  slow: boolean
  pending: SittingPending
  friends: RecentSitter[]
  board: ReactNode
  onHost: () => void
  onJoin: () => void
  onLeave: () => void
  onCopy: () => void
  copied: boolean
  copyFailed: boolean
}

export function SittingSheet({
  open,
  onClose,
  name,
  onName,
  joinCode,
  onJoinCode,
  query,
  onQuery,
  status,
  code,
  inviteUrl,
  message,
  slow,
  pending,
  friends,
  board,
  onHost,
  onJoin,
  onLeave,
  onCopy,
  copied,
  copyFailed,
}: SittingSheetProps) {
  const live = status === 'live'
  const busy = status === 'connecting'
  const nameIssue = name.trim() ? parseSittingName(name) : null
  const shownFriends = filterRecentSitters(friends, query)
  const showFriendSearch = friends.length >= 6 || query.trim().length > 0
  const joinReady = Boolean(normalizeSittingCode(joinCode))

  function handleHost(event: FormEvent) {
    event.preventDefault()
    onHost()
  }

  return (
    <SettingsSheet open={open} onClose={onClose} title="Table" closeLabel="Close">
      <div className="sit-stack">
      <form className="sit-form" onSubmit={handleHost}>
        <label className="sit-field">
          <span>Your name</span>
          <input
            value={name}
            onChange={(event) => onName(event.target.value)}
            maxLength={24}
            autoComplete="nickname"
            spellCheck={false}
            placeholder="Friends see this"
            aria-invalid={Boolean(nameIssue && !nameIssue.ok)}
          />
        </label>
        {nameIssue && !nameIssue.ok ? (
          <p className="sit-error" role="alert">
            {sittingErrorMessage(nameIssue.error)}
          </p>
        ) : (
          <p className="sit-hint">Friends see this on the table.</p>
        )}

        {live && code ? (
          <div className="sit-live">
            <p className="sit-code" aria-label={`Table code ${code.split('').join(' ')}`}>
              {code}
            </p>
            <div className="sit-actions">
              <button type="button" className="btn btn-quiet" onClick={onCopy}>
                {copied ? 'Copied' : copyFailed ? 'Select the code' : 'Copy link'}
              </button>
              <button type="button" className="btn btn-quiet" onClick={onLeave}>
                Leave
              </button>
            </div>
            {inviteUrl ? (
              copyFailed ? (
                <p className="sit-hint">
                  Couldn’t copy. Select the code above, or this link:
                  <span className="sit-invite">{inviteUrl}</span>
                </p>
              ) : (
                <p className="sit-hint">
                  Share the code or this link. Anyone with it can sit. There is no public list of tables.
                </p>
              )
            ) : null}
          </div>
        ) : (
          <>
            <button type="submit" className="btn btn-primary sit-host" disabled={busy}>
              {busy && pending === 'host' ? 'Opening…' : 'Host'}
            </button>
            <p className="sit-or">Or join</p>
            <div className="sit-join">
              <label className="sit-field">
                <span>Host’s code</span>
                <input
                  value={joinCode}
                  onChange={(event) => onJoinCode(event.target.value.toUpperCase())}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      onJoin()
                    }
                  }}
                  maxLength={8}
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="Four letters"
                  aria-label="Host’s code"
                />
              </label>
              <button
                type="button"
                className={`btn sit-join-go ${joinReady ? 'btn-primary' : 'btn-quiet'}`}
                disabled={busy || !joinReady}
                onClick={() => onJoin()}
              >
                {busy && pending === 'join' ? 'Joining…' : 'Join'}
              </button>
            </div>
          </>
        )}

        {slow ? (
          <p className="sit-hint" role="status">
            Opening…
          </p>
        ) : null}
        {message ? (
          <p className="sit-error" role="alert">
            {message}
          </p>
        ) : null}
      </form>

      <div className="sit-history">
        {live && board ? <div className="sit-sheet-board">{board}</div> : null}

        {!live && friends.length > 0 ? (
          <div className="sit-friends">
            <p className="sit-friends-label">Last tables</p>
            {showFriendSearch ? (
              <label className="sit-field">
                <input
                  value={query}
                  onChange={(event) => onQuery(event.target.value)}
                  placeholder="Find a name"
                  spellCheck={false}
                  aria-label="Find a name"
                />
              </label>
            ) : null}
            {shownFriends.length > 0 ? (
              <ul className="sit-friend-list" aria-label="Last tables">
                {shownFriends.map((friend) => (
                  <li key={`${friend.name}-${friend.code}`}>
                    <button
                      type="button"
                      className="sit-friend"
                      onClick={() => onJoinCode(friend.code)}
                    >
                      <strong>{friend.name}</strong>
                      <small>{friend.code}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sit-hint">No names match.</p>
            )}
          </div>
        ) : null}

        {!live && friends.length === 0 ? (
          <p className="sit-floor" role="status">
            No recent tables. Host one, or join with a four-letter code. There is no public list.
          </p>
        ) : null}
      </div>
      </div>
    </SettingsSheet>
  )
}

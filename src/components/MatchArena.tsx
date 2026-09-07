import { SongIdentity } from './SongIdentity'
import { HostMix } from './HostMix'
import { activeFilterCount, type CatalogFilters } from '../lib/filters'
import { audioSrcMatches } from '../lib/audio-playback'
import { buttonSoundsEnabled, setButtonSounds } from "../lib/ui-audio";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Headphones,
  Pause,
  Play,
  SkipForward,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  MATCH_LENGTH,
  MATCH_SUGGESTION_LIMIT,
  matchSeatLabel,
  matchStreak,
  MATCH_POINTS,
  MATCH_STAGES,
  type MatchDifficulty,
} from "../../shared/match";
import { MAX_SITTING_PLAYERS } from "../../shared/sitting";
import type { useSitting } from "../hooks/useSitting";
import { Noot3D } from "./Noot3D";
import { searchTracks, type SearchResult } from "../lib/api";
import "../match.css";
import { loadVolume } from "../lib/game-state";

type Table = ReturnType<typeof useSitting>;
const EMPTY_FILTERS: CatalogFilters = {
  eras: [],
  genres: [],
  countries: [],
  collections: [],
  artists: [],
};
export function MatchArena({
  table,
  theme,
  initialFilters = EMPTY_FILTERS,
}: {
  table: Table;
  theme: "light" | "dark";
  initialFilters?: CatalogFilters;
}) {
  const { match, players, playerId, hostId, sendMatch } = table;
  const [sounds, setSounds] = useState(buttonSoundsEnabled);
  const [difficulty, setDifficulty] = useState<MatchDifficulty | "mixed">(
    "mixed",
  );
  const [length, setLength] = useState(10);
  const [mixOpen, setMixOpen] = useState(false);
  const [filters, setFilters] = useState<CatalogFilters>(initialFilters);
  const [carryScores, setCarryScores] = useState(false);
  const [friendId, setFriendId] = useState("");
  const [greeting, setGreeting] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<SearchResult[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [searchSettled, setSearchSettled] = useState(false);
  const [heardClip, setHeardClip] = useState(false);
  const [hearReveal, setHearReveal] = useState(false);
  const [playing, setPlaying] = useState(false),
    [audioError, setAudioError] = useState(""),
    [pending, setPending] = useState(false),
    [copied, setCopied] = useState(false);
  const playbackToken = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null),
    stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioUnlocked = useRef(false);
  const autoClipRound = useRef<string | null>(null);
  const suggestionsRef = useRef<HTMLUListElement | null>(null);
  const me = match?.entries.find((p) => p.id === playerId);
  const stage = me?.stage ?? 0;
  const isHost = hostId === playerId,
    connected = table.status === "live";
  const revealed = Boolean(match && match.phase !== "playing"),
    finished = match?.phase === "finished";
  const countdown = match
    ? Math.max(0, Math.ceil((match.startsAt - now - table.clockOffset) / 1000))
    : 0;
  const remaining = match
    ? Math.max(0, Math.ceil((match.deadline - now - table.clockOffset) / 1000))
    : 90;
  const canPlay =
    connected &&
    match?.phase === "playing" &&
    me?.status === "playing" &&
    countdown === 0 &&
    remaining > 0;
  const stop = () => {
    playbackToken.current++;
    audio.current?.pause();
    if (stopTimer.current) clearTimeout(stopTimer.current);
    setPlaying(false);
  };
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    setPending(false);
    setQuery("");
    setResults([]);
    setHighlight(0);
    if (match?.phase === "playing") stop();
  }, [match?.roundId, stage, me?.status]);
  useEffect(() => {
    setHeardClip(false);
    setHearReveal(false);
    autoClipRound.current = null;
  }, [match?.roundId]);
  useEffect(() => {
    if (table.matchError) setPending(false);
  }, [table.matchError]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(false), 4000);
    return () => clearTimeout(timer);
  }, [pending]);
  useEffect(() => {
    const el = audio.current ?? new Audio();
    audio.current = el;
    el.preload = "auto";
    el.onended = () => setPlaying(false);
    el.onerror = () => {
      setPlaying(false);
      setAudioError("The audio couldn’t load. Tap play to retry.");
    };
    return () => {
      el.onerror = null;
      el.onended = null;
      el.pause();
      el.removeAttribute("src");
      el.load();
      if (stopTimer.current) clearTimeout(stopTimer.current);
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    const el = audio.current;
    if (!el || !match?.audio) return;
    if (!audioSrcMatches(el, match.audio)) {
      el.src = match.audio;
      el.load();
    }
    el.volume = loadVolume();
  }, [match?.audio, match?.roundId]);
  useEffect(() => {
    const unlock = () => {
      if (audioUnlocked.current) return;
      const el = audio.current;
      if (!el) return;
      const wasMuted = el.muted;
      el.muted = true;
      void el
        .play()
        .then(() => {
          el.pause();
          el.muted = wasMuted;
          audioUnlocked.current = true;
        })
        .catch(() => {
          el.muted = wasMuted;
        });
    };
    document.addEventListener("pointerdown", unlock);
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);
  useEffect(() => {
    if (!canPlay && !revealed) stop();
  }, [canPlay, revealed]);
  useEffect(() => {
    if (!revealed || !match || !audio.current) return;
    setHearReveal(false);
    void startPlayback();
    return () => stop();
  }, [revealed, match?.roundId]);
  useEffect(() => {
    if (!canPlay || !match || autoClipRound.current === match.roundId) return;
    autoClipRound.current = match.roundId;
    void startPlayback();
  }, [canPlay, match?.roundId]);
  useEffect(() => {
    if (!query.trim() || !canPlay) {
      setResults([]);
      setSearchSettled(false);
      return;
    }
    let cancelled = false;
    setSearchSettled(false);
    const timer = setTimeout(() => {
      searchTracks(query)
        .then((items) => {
          if (cancelled) return;
          const hits = items.slice(0, MATCH_SUGGESTION_LIMIT);
          setResults(hits);
          setHighlight(0);
          setSearchSettled(true);
        })
        .catch(() => {
          if (cancelled) return
          setResults([])
          setSearchSettled(true)
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, canPlay]);
  function play() {
    if (playing) stop();
    else void startPlayback();
  }
  async function startPlayback() {
    const el = audio.current;
    if (!el || !match) return;
    setAudioError("");
    const token = ++playbackToken.current;
    try {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      // A failed media element must reload before a user-triggered retry.
      if (el.error) el.load();
      el.volume = loadVolume();
      el.currentTime = match.offset;
      await el.play();
      if (token !== playbackToken.current) {
        el.pause();
        return;
      }
      setPlaying(true);
      if (revealed) setHearReveal(false);
      else setHeardClip(true);
      stopTimer.current = setTimeout(
        stop,
        (revealed ? 15 : MATCH_STAGES[stage]) * 1000,
      );
    } catch (error) {
      if (token !== playbackToken.current) return
      setPlaying(false)
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        if (revealed) setHearReveal(true)
        else setAudioError("Press play to hear the clip.")
        return
      }
      setAudioError("Couldn’t play the audio. Tap play to retry.")
    }
  }
  function guess(value: string, trackId?: string) {
    if (!canPlay || pending || !value.trim() || !match) return;
    stop();
    setPending(true);
    sendMatch({
      type: "match-guess",
      roundId: match.roundId,
      stage,
      guess: value,
      trackId,
    });
  }
  function skip() {
    if (!canPlay || pending || !match) return;
    stop();
    setPending(true);
    sendMatch({ type: "match-skip", roundId: match.roundId, stage });
  }
  const entries = match
    ? [...match.entries].sort((a, b) => b.points - a.points)
    : [];
  const ahead = entries.filter((p) => me && p.points > me.points).at(-1);
  const myRank = me ? entries.findIndex((p) => p.points === me.points) + 1 : 0;
  const solved = entries
    .filter((p) => p.status === "solved")
    .sort((a, b) => (a.solvedAt ?? 0) - (b.solvedAt ?? 0));
  const timedOut = Boolean(
    revealed &&
      solved.length === 0 &&
      match?.entries.some((p) => p.lastAction === "timeout"),
  );
  const tiedOnZero = Boolean(me && entries.every((p) => p.points === 0));
  const soleLeader = Boolean(
    entries[0] &&
      entries[0].points > 0 &&
      entries.filter((p) => p.points === entries[0]!.points).length === 1,
  );
  const boardTarget = ahead
    ? `${ahead.points - me!.points} to catch ${ahead.name}`
    : me && !tiedOnZero
      ? entries.filter((p) => p.points === me.points).length > 1
        ? "Tied."
        : "You’re leading."
      : "";
  const waitingNames = match
    ? match.entries
        .filter(
          (p) =>
            !p.ready && players.some((q) => q.id === p.id && q.connected),
        )
        .map((p) => p.name)
    : [];
  const readyCount = match
    ? match.entries.filter((p) =>
        p.ready && players.some((q) => q.id === p.id && q.connected),
      ).length
    : 0;
  const connectedPlayers = match
    ? match.entries.filter((p) =>
        players.some((q) => q.id === p.id && q.connected),
      ).length
    : 0;
  const newcomer = players
    .filter(
      (p) =>
        p.id !== playerId &&
        p.connected &&
        now + table.clockOffset - p.joinedAt < 4000,
    )
    .at(-1);
  const incoming = players.find((p) => p.id === playerId)?.greeting;
  const helloActive =
    Boolean(incoming && now - incoming.at < 3500) ||
    now - greeting < 3500 ||
    Boolean(newcomer);
  const party = players.filter(p => p.connected)
  const companion = (
    <div className="noot-party" aria-label="Noots at this table" data-count={party.length} style={{ '--party-n': party.length } as CSSProperties}>
      {party.map(p => {
        const entry = entries.find(e => e.id === p.id);
        const wave = (incoming?.from === p.id && helloActive) || (p.id === friendId && now - greeting < 3500);
        const fresh = Boolean(entry?.solvedAt && now + table.clockOffset - entry.solvedAt < 3200);
        return <div className="noot-party-member" key={p.id} data-you={p.id === playerId} data-solved={entry?.status === "solved"} data-ready={entry?.ready}>
          <span className="party-reaction" aria-hidden="true">{wave ? "Hello!" : revealed && entry?.ready ? "Ready!" : revealed && entry?.status === "solved" ? `+${entry.delta}` : ""}</span>
          <button className="mascot party-pet" aria-label={p.id === playerId ? 'Customize your Noot' : `Wave to ${p.name}’s Noot`}
            onClick={() => { if (p.id === playerId) window.dispatchEvent(new Event('open-noot-profile')); else { setFriendId(p.id); table.greet(p.id); setGreeting(Date.now()); } }}>
            <Noot3D {...(p.appearance ?? {headgear:'headphones',clothing:'none',eyewear:'none',accessoryColor:'blue',pattern:'plain'})}
              pose={fresh ? 'cheer' : wave || newcomer?.id === p.id ? 'hover' : entry?.ready ? 'hover' : entry?.status === 'solved' ? 'win' : p.id === playerId && playing ? 'play' : 'idle'}
              eventId={Math.max(entry?.solvedAt ?? 0, p.joinedAt, wave ? greeting : 0, wave ? incoming?.at ?? 0 : 0)} difficulty="easy" theme={theme}/>
          </button>
          <strong>{p.name}{p.id === playerId ? ' · you' : ''}</strong>
          <small>{revealed ? "" : [entry && matchStreak(entry, false) > 1 ? `${matchStreak(entry, false)} in a row` : "", entry ? matchSeatLabel(entry, false) : !match ? "Ready to listen" : "Listening"].filter(Boolean).join(" · ")}</small>
        </div>;
      })}
    </div>
  );
  const onlineCount = players.filter((p) => p.connected).length;
  async function copy() {
    try {
      await navigator.clipboard.writeText(table.inviteUrl ?? table.code ?? "");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <main
      className="app-shell match-room"
      data-theme={theme}
      data-difficulty={match?.difficulty ?? (difficulty === "mixed" ? "easy" : difficulty)}
      data-sound-playing={playing}
    >
      {mixOpen && <HostMix value={filters} difficulty={difficulty === "mixed" ? "easy" : difficulty} onClose={()=>setMixOpen(false)} onApply={value=>{setFilters(value);setMixOpen(false)}}/>}
      <header className="match-header">
        <button
          className="match-icon-btn"
          aria-pressed={sounds}
          aria-label={sounds ? "Sounds on" : "Sounds off"}
          title={sounds ? "Sounds on" : "Sounds off"}
          onClick={() => {setSounds(!sounds);setButtonSounds(!sounds);}}
        >
          {sounds ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <button
          className="match-back"
          onClick={() => {
            stop();
            table.leave();
          }}
        >
          <ArrowLeft size={16} /> Leave table
        </button>
        <button
          className="profile-edit"
          onClick={() => window.dispatchEvent(new Event("open-noot-profile"))}
        >
          Your Noot
        </button>
        <a href="/" className="match-brand">
          <img src="/app-icons/noot-app-icon.png" alt="" />
          SongGuessr
        </a>
        <button
          className="match-code"
          onClick={() => void copy()}
          aria-label={`Share table code ${table.code ?? ""}`}
        >
          <span className="match-code-label">Table</span>
          {table.code}
          <Copy size={14} />
          {copied && <small>Copied</small>}
        </button>
      </header>
      {!connected && (
        <p className="match-notice" role="status">
          Reconnecting to your table. Scores and stages are saved.{" "}
          <button onClick={table.reconnect}>Reconnect</button>
        </p>
      )}
      {table.matchError && (
        <p className="match-notice" role="alert">
          {table.matchError}
        </p>
      )}
      {!match ? (
        <div className="match-lobby">
          <section className="match-lobby-copy">
            <span className="match-kicker">Your table</span>
            <h1>Play together.</h1>
            <p>
              One song for everyone. Skip at your own pace, then move on when
              everyone is ready.
            </p>
            <div className="match-rules">
              <span>
                <Headphones size={18} /> Same song for everyone
              </span>
              <span>
                <SkipForward size={18} /> Skip at your own pace
              </span>
              <span>
                <Trophy size={18} /> Up to 1,000 points a song
              </span>
            </div>
            {companion}
          </section>
          <section className="match-lobby-card">
            <div className="match-section-heading">
              <h2>Your listening party</h2>
              <span>{onlineCount}/{MAX_SITTING_PLAYERS}</span>
            </div>
            <ul className="match-guests">
              {players.map((p) => (
                <li key={p.id}>
                  <span className="match-avatar">
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <strong>
                    <button
                      className="friend-name"
                      onClick={() => setFriendId(p.id)}
                    >
                      {p.name}
                    </button>
                    {p.id === playerId && <small> you</small>}
                  </strong>
                  <span>
                    {p.id === hostId ? "Host" : p.connected ? "Ready" : "Away"}
                  </span>
                </li>
              ))}
            </ul>
            <label className="match-difficulty">
              {isHost ? "Song difficulty" : "The host chooses song difficulty"}
              {isHost && (
                <select
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(e.target.value as MatchDifficulty | "mixed")
                  }
                  disabled={!isHost}
                >
                  {[
                    "mixed",
                    "easy",
                    "medium",
                    "hard",
                    "expert",
                    "impossible",
                  ].map((d) => (
                    <option key={d} value={d}>
                      {d === "mixed" ? "Auto · all difficulties" : d}
                    </option>
                  ))}
                </select>
              )}
            </label>
            {isHost && (
              <>
                <button className="profile-edit" onClick={()=>setMixOpen(true)}>Mix · artists, genres & exclusions</button>
                <label className="match-difficulty">
                  Songs per match
                  <select
                    value={length}
                    onChange={(e) => setLength(Number(e.target.value))}
                  >
                    {[5, 10, 15, 20].map((n) => (
                      <option key={n} value={n}>
                        {n} songs
                      </option>
                    ))}
                  </select>
                </label>
                <label className="match-difficulty">
                  After each match
                  <select
                    value={String(carryScores)}
                    onChange={(e) => setCarryScores(e.target.value === "true")}
                  >
                    <option value="false">Reset scores</option>
                    <option value="true">Keep adding points</option>
                  </select>
                </label>
              </>
            )}
            <p className="match-fine">
              {isHost
                ? `${activeFilterCount(filters) > 0 ? "Your Mix from solo" : "Global mix"} · same intro · 90 seconds per song`
                : "The host sets the mix · same intro · 90 seconds per song"}
              <br />
              {isHost
                ? `Share code ${table.code} or the invite link. Need two people to start.`
                : "Waiting here until the host starts."}
              <br />
              {carryScores
                ? "Points carry into the next match."
                : "Each match starts at zero."}{" "}
              Equal scores share a rank.
            </p>
            {isHost ? (
              onlineCount < 2 ? (
                <button className="match-primary" disabled={!connected} onClick={() => void copy()}>
                  {copied ? "Invite copied — send it" : "Copy invite link"}
                  <Copy size={18} />
                </button>
              ) : (
              <button
                className="match-primary"
                disabled={pending || !connected}
                onClick={() => {
                  setPending(true);
                  sendMatch({
                    type: "match-start",
                    difficulty,
                    length,
                    carryScores,
                    filters,
                  });
                }}
              >
                {pending
                  ? "Finding your first song…"
                  : "Start the match"}
                <ArrowRight size={18} />
              </button>
              )
            ) : (
              <p className="match-wait">Waiting for the host to start…</p>
            )}
            <button className="match-invite" onClick={() => void copy()}>
              {copied ? "Copied" : `Share ${table.code ?? "this table"}`}
              <Copy size={15} />
            </button>
          </section>
        </div>
      ) : (
        <>
          <div className="match-layout">
            <section className="match-stage">
          <div className="match-progress">
            <span>
              {finished
                ? "Match complete"
                : `Song ${String(match.number).padStart(2, "0")} / ${match.length ?? MATCH_LENGTH} · ${match.difficulty}`}
            </span>
            <div
              aria-label={`Song ${match.number} of ${match.length ?? MATCH_LENGTH}`}
            >
              {Array.from({ length: match.length ?? MATCH_LENGTH }, (_, i) => (
                <i
                  key={i}
                  data-done={i < match.number - 1 || finished}
                  data-current={i === match.number - 1}
                />
              ))}
            </div>
          </div>
              {(!revealed || finished) && (
              <div className="match-stage-title">
                <span className="match-kicker">
                  {finished
                    ? "Final standings"
                    : !me
                      ? "You’re spectating"
                      : me.status === "solved"
                        ? "Locked in. Nice ears."
                        : me.status === "out"
                          ? "Let’s hear from the others"
                          : countdown > 0
                            ? "Everyone starts together"
                            : heardClip
                              ? "Name this song"
                              : "Press play to hear it"}
                </span>
                <h1>
                  {finished
                    ? entries.filter((p) => p.points === entries[0]?.points)
                        .length > 1
                      ? "A shared victory."
                      : `${entries[0]?.name} takes it.`
                    : countdown > 0
                      ? `Starts in ${countdown}`
                      : `${MATCH_STAGES[stage]}s clip`}
                </h1>
                {!revealed && countdown === 0 && canPlay ? (
                  <p>{heardClip ? `${MATCH_POINTS[stage].toLocaleString()} points if you name it now.` : "A short clip. Press play, then type the title."}</p>
                ) : null}
              </div>
              )}
              {!revealed && (
              <div className="match-theatre shared-stage">
                {companion}
                <div className="match-floor" />
              </div>
              )}
              {!revealed ? (
                <>
                  <div className="match-stakes">
                    <strong>
                      {me?.status === "solved"
                        ? `+${me.delta.toLocaleString()}`
                        : canPlay
                          ? MATCH_POINTS[stage].toLocaleString()
                          : "—"}
                      <small>
                        {me?.status === "solved"
                          ? "points secured"
                          : "points available"}
                      </small>
                    </strong>
                    <span
                      className="match-clock"
                      data-urgent={remaining <= 15}
                      aria-label={`${remaining} seconds left in this round`}
                    >
                      {Math.floor(remaining / 60)}:
                      {String(remaining % 60).padStart(2, "0")}
                      <small>left in this round</small>
                    </span>
                  </div>
                  <ol className="match-clips" aria-label="Clip scoring ladder">
                    {MATCH_STAGES.map((seconds, i) => (
                      <li
                        key={seconds}
                        data-active={i === stage}
                        data-used={i < stage}
                      >
                        <strong>
                          {seconds}
                          <small>s</small>
                        </strong>
                        <span>{MATCH_POINTS[i]} pts</span>
                      </li>
                    ))}
                  </ol>
                  {canPlay ? (
                    <div className="match-dock">
                    <div className="match-controls">
                      <button
                        className="match-play"
                        onClick={play}
                        aria-label={
                          playing
                            ? "Stop clip"
                            : `Play ${MATCH_STAGES[stage]} second clip`
                        }
                      >
                        {playing ? <Pause /> : <Play />}
                      </button>
                      <form
                        className="match-guess"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const pick = results[highlight];
                          if (pick) guess(`${pick.title} - ${pick.artist}`, pick.id);
                          else guess(query);
                        }}
                      >
                        <input
                          aria-label="Name the song"
                          placeholder="Name the song…"
                          maxLength={200}
                          value={query}
                          onChange={(e) => {
                            setQuery(e.target.value);
                            setHighlight(0);
                          }}
                          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                            if (event.key === "Escape") {
                              setResults([]);
                              return;
                            }
                            if (results.length === 0) return;
                            if (event.key === "ArrowDown") {
                              event.preventDefault();
                              setHighlight((current) =>
                                Math.min(current + 1, results.length - 1),
                              );
                              return;
                            }
                            if (event.key === "ArrowUp") {
                              event.preventDefault();
                              setHighlight((current) => Math.max(current - 1, 0));
                            }
                          }}
                          autoComplete="off"
                          spellCheck={false}
                          role="combobox"
                          aria-expanded={results.length > 0}
                          aria-controls="match-suggestions"
                          aria-activedescendant={
                            results[highlight]
                              ? `match-opt-${results[highlight].id}`
                              : undefined
                          }
                          disabled={pending}
                        />
                        <button
                          aria-label="Submit guess"
                          disabled={pending || !query.trim()}
                        >
                          <ArrowRight size={20} />
                        </button>
                        {query.trim() && results.length > 0 && (
                          <ul
                            className="match-suggestions"
                            id="match-suggestions"
                            role="listbox"
                            aria-label="Song suggestions"
                            ref={suggestionsRef}
                          >
                            {results.map((r, index) => (
                              <li key={r.id}>
                                <button
                                  type="button"
                                  id={`match-opt-${r.id}`}
                                  role="option"
                                  aria-selected={index === highlight}
                                  className={index === highlight ? "is-active" : undefined}
                                  onMouseEnter={() => setHighlight(index)}
                                  onClick={() =>
                                    guess(`${r.title} - ${r.artist}`, r.id)
                                  }
                                >
                                  <span className="match-option-cover" aria-hidden="true">
                                    {r.albumArt ? <img src={r.albumArt} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }} /> : <Headphones size={20} />}
                                  </span>
                                  <span className="match-option-copy"><strong>{r.title}</strong>
                                  <small>{r.artist}</small></span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {query.trim() && searchSettled && results.length === 0 && (
                          <p className="match-suggestions match-suggestions-empty" role="status">
                            No titles match yet. Try a few letters, or skip for a longer clip.
                          </p>
                        )}
                      </form>
                      <button
                        className="match-skip"
                        onClick={skip}
                        disabled={pending}
                        title={stage === 4 ? "Give up this song" : "Hear a longer clip, worth fewer points"}
                      >
                        <SkipForward size={16} />
                        {stage === 4 ? "Pass" : "Skip"}
                      </button>
                    </div>
                    </div>
                  ) : (
                    <p className="match-wait" role="status">
                      {countdown
                        ? "Everyone starts together."
                        : !me
                          ? "Join the next match to play."
                          : `${match.entries.filter((p) => p.status === "playing").length} still listening. The answer reveals together.`}
                    </p>
                  )}
                  <p className="match-feedback" role="status">
                    {audioError ||
                      (me?.lastAction === "miss"
                        ? "Not that one. A longer clip is unlocked — fewer points if you need it."
                        : canPlay
                          ? "Type the full title. Skip for a longer clip, worth fewer points."
                          : "")}
                  </p>
                </>
              ) : (
                <div className="match-recap round-answer" role="region" aria-label="Song result">
                  <div className="match-answer-row">
                    {match.answer && (
                      <button
                        className="match-album"
                        onClick={play}
                        aria-label={
                          playing
                            ? "Pause the song"
                            : `Play ${match.answer.title}`
                        }
                      >
                        {match.answer.albumArt ? <img
                          src={match.answer.albumArt}
                          alt=""
                        /> : <Headphones size={32} />}
                        <span>
                          {playing ? <Pause size={18} /> : <Play size={18} />}
                        </span>
                      </button>
                    )}
                    <div className="match-answer-copy">
                      {match.answer && <SongIdentity title={match.answer.title} artist={match.answer.artist} />}
                      <strong>
                        {me ? `+${me.delta.toLocaleString()}` : "Good listening."}
                        <small>{me ? "this song" : ""}</small>
                      </strong>
                      <p className="match-outcome">
                        {finished
                          ? `${match.length ?? 10} songs complete. ${me ? `You finished #${myRank} with ${me.points.toLocaleString()} points.` : ""}`
                          : me?.status === "solved"
                            ? `Named at ${MATCH_STAGES[me.stage]} seconds.${ahead ? ` ${ahead.points - me.points} to catch ${ahead.name}.` : " You’re in the lead."}`
                            : timedOut
                              ? "Nobody named it in time."
                              : "Nobody named this one."}
                      </p>
                    </div>
                  </div>
                  <div className="match-recap-party">
                    {companion}
                  </div>
                  {hearReveal && (
                    <button className="match-hear" type="button" onClick={play}>
                      <Play size={18} />
                      Tap to hear it
                    </button>
                  )}
                  {audioError && <p className="match-feedback" role="alert">{audioError}</p>}
                  {me ? (
                    <div className="match-ready">
                      {(me.ready || finished) && (
                      <p className="match-waiting" role="status">
                        {me.ready
                          ? waitingNames.length
                            ? `Waiting for ${waitingNames.join(", ")}.`
                            : table.matchError
                              ? "The next song couldn’t load. Try again when you’re ready."
                              : "Everyone is ready. Preparing your next song…"
                          : "Next song when everyone is ready."}
                      </p>
                      )}
                      <button
                        className="match-primary"
                        disabled={
                          pending || !connected || (Boolean(me.ready) && waitingNames.length > 0) || (finished && onlineCount < 2)
                        }
                        onClick={() => {
                          setPending(true);
                          sendMatch({
                            type: "match-next",
                            roundId: match.roundId,
                          });
                        }}
                      >
                        {pending
                          ? "Waiting…"
                          : me.ready
                            ? waitingNames.length ? "Ready · waiting" : "Try loading next song"
                            : finished
                              ? "Ready for another match"
                              : "I’m ready"}
                        <Check size={17} />
                      </button>
                      <small>
                        {readyCount} / {connectedPlayers} ready
                        {finished
                          ? match.carryScores
                            ? " · points carry over"
                            : " · scores reset"
                          : ""}
                      </small>
                    </div>
                  ) : (
                    <p className="match-wait">Waiting for the players.</p>
                  )}
                </div>
              )}
            </section>
            <aside className="match-board">
              {!revealed && (
              <div className="match-solved" role="status" aria-live="polite">
                {solved.length > 0 ? (
                  <>
                    <Check size={15} />
                    <span>
                      {solved
                        .map((p) => (p.id === playerId ? "You" : p.name))
                        .join(", ")}{" "}
                      got it
                      <small>
                        {solved.length} / {entries.length} named this song
                      </small>
                    </span>
                  </>
                ) : (
                  <span>
                    Who will recognize it?
                    <small>Same clip length, same points.</small>
                  </span>
                )}
              </div>
              )}
              <div className="match-section-heading">
                <h2>{finished ? "Final scores" : "Standings"}</h2>
              </div>
              {boardTarget ? (
                <p className="match-board-target">{boardTarget}</p>
              ) : null}
              <ol>
                {entries.map((p) => {
                  const rank =
                    entries.findIndex((e) => e.points === p.points) + 1;
                  const online = players.some(
                    (e) => e.id === p.id && e.connected,
                  );
                  const leadHere = soleLeader && p.points === entries[0]?.points;
                  return (
                    <li key={p.id} data-you={p.id === playerId}>
                      <span className="match-rank">
                        {leadHere ? <Trophy size={16} /> : rank}
                      </span>
                      <div>
                        <strong>
                          <button
                            className="friend-name"
                            onClick={() => setFriendId(p.id)}
                            aria-label={`View ${p.name}’s Noot`}
                          >
                            {p.name}
                          </button>
                          {p.id === playerId && <small> you</small>}
                        </strong>
                        {(() => {
                          const line = !online
                            ? "Reconnecting"
                            : matchSeatLabel(p, revealed);
                          return line ? <p>{line}</p> : null;
                        })()}
                        {!revealed && (
                        <div className="match-player-stages">
                          {MATCH_STAGES.map((_, i) => (
                            <i
                              key={i}
                              data-lit={i <= p.stage}
                              data-solved={p.status === "solved"}
                            />
                          ))}
                        </div>
                        )}
                      </div>
                      <b>{p.points.toLocaleString()}</b>
                    </li>
                  );
                })}
              </ol>
              {!revealed && (
              <div className="match-board-note">
                <Check size={15} />
                <p>
                  Same song. Same points for the same clip.
                  <br />
                  Skip only changes your clip.
                </p>
              </div>
              )}
            </aside>
          </div>
        </>
      )}
      {!match && (
      <footer className="match-footer">
        <span>Made for music. Better with company.</span>
        <span>No speed bonus. Just good ears.</span>
      </footer>
      )}
    </main>
  );
}

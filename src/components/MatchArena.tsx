import { MATCH_ERAS, MATCH_GENRES, MATCH_COUNTRIES, type MatchFilters } from '../../shared/match-filters'
import useSound from "use-sound";
import { buttonSoundsEnabled, setButtonSounds } from "../lib/ui-audio";
import { useEffect, useRef, useState } from "react";
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
  Users,
} from "lucide-react";
import {
  MATCH_LENGTH,
  matchStreak,
  MATCH_POINTS,
  MATCH_STAGES,
  type MatchDifficulty,
} from "../../shared/match";
import type { useSitting } from "../hooks/useSitting";
import { Noot3D } from "./Noot3D";
import { useNootPreferences } from "../lib/noot/preferences";
import { searchTracks, type SearchResult } from "../lib/api";
import "../match.css";
import { loadVolume } from "../lib/game-state";

type Table = ReturnType<typeof useSitting>;
export function MatchArena({
  table,
  theme,
}: {
  table: Table;
  theme: "light" | "dark";
}) {
  const { match, players, playerId, hostId, sendMatch } = table;
  const [sounds, setSounds] = useState(buttonSoundsEnabled);
  const [playTap] = useSound('/audio/ui-tap.wav', { volume: 0.18 * loadVolume(), interrupt: true, soundEnabled: sounds });
  const [difficulty, setDifficulty] = useState<MatchDifficulty | "mixed">(
    "mixed",
  );
  const [length, setLength] = useState(10);
  const [filters, setFilters] = useState<MatchFilters>({});
  const [carryScores, setCarryScores] = useState(false);
  const [friendId, setFriendId] = useState("");
  const [greeting, setGreeting] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<SearchResult[]>([]);
  const [playing, setPlaying] = useState(false),
    [audioError, setAudioError] = useState(""),
    [pending, setPending] = useState(false),
    [copied, setCopied] = useState(false);
  const [preferences] = useNootPreferences();
  const playbackToken = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null),
    stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    stop();
  }, [match?.roundId, stage, me?.status, match?.phase]);
  useEffect(() => {
    if (table.matchError) setPending(false);
  }, [table.matchError]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(false), 4000);
    return () => clearTimeout(timer);
  }, [pending]);
  useEffect(() => {
    if (!match?.audio) return;
    const el = new Audio(match.audio);
    el.preload = "auto";
    el.volume = loadVolume();
    audio.current = el;
    el.onended = () => setPlaying(false);
    el.onerror = () => { setPlaying(false); setAudioError("The audio couldn’t load. Tap play to retry."); };
    return () => {
      el.onerror = null;
      el.onended = null;
      el.pause();
      el.removeAttribute("src");
      el.load();
      if (stopTimer.current) clearTimeout(stopTimer.current);
      audio.current = null;
    };
  }, [match?.audio, match?.roundId]);
  useEffect(() => {
    if (!canPlay) stop();
  }, [canPlay]);
  useEffect(() => {
    if (!revealed || !match || !audio.current) return;
    void startPlayback();
    return () => stop();
  }, [revealed, match?.roundId]);
  useEffect(() => {
    if (!query.trim() || !canPlay) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchTracks(query)
        .then((items) => {
          if (!cancelled) setResults(items);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
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
      stopTimer.current = setTimeout(
        stop,
        (revealed ? 15 : MATCH_STAGES[stage]) * 1000,
      );
    } catch {
      if (token === playbackToken.current) { setPlaying(false); setAudioError("Couldn’t play the audio. Tap play to retry."); }
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
  const mascotPose = finished
    ? "cheer"
    : revealed
      ? me?.status === "solved"
        ? "win"
        : "lose"
      : me?.status === "solved"
        ? "listen-close"
        : playing
          ? "play"
          : me?.lastAction === "skip"
            ? "skip"
            : "idle";
  const solved = entries
    .filter((p) => p.status === "solved")
    .sort((a, b) => (a.solvedAt ?? 0) - (b.solvedAt ?? 0));
  const latestSolve = solved.at(-1);
  const solveFresh = Boolean(
    latestSolve?.solvedAt &&
    now + table.clockOffset - latestSolve.solvedAt < 3200,
  );
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
  const companion = (
    <div className="noot-party" aria-label="Noots at this table">
      {players.filter(p => p.connected).map(p => {
        const entry = entries.find(e => e.id === p.id);
        const wave = (incoming?.from === p.id && helloActive) || (p.id === friendId && now - greeting < 3500);
        const fresh = Boolean(entry?.solvedAt && now + table.clockOffset - entry.solvedAt < 3200);
        return <div className="noot-party-member" key={p.id}>
          <button className="mascot party-pet" aria-label={p.id === playerId ? 'Customize your Noot' : `Wave to ${p.name}’s Noot`}
            onClick={() => { playTap(); if (p.id === playerId) window.dispatchEvent(new Event('open-noot-profile')); else { setFriendId(p.id); table.greet(p.id); setGreeting(Date.now()); } }}>
            <Noot3D {...(p.appearance ?? {headgear:'headphones',clothing:'none',eyewear:'none',accessoryColor:'blue',pattern:'plain'})}
              pose={fresh ? 'cheer' : wave || newcomer?.id === p.id ? 'hover' : 'idle'}
              eventId={Math.max(entry?.solvedAt ?? 0, p.joinedAt, wave ? greeting : 0, wave ? incoming?.at ?? 0 : 0)} difficulty="easy" theme={theme}/>
          </button>
          <strong>{p.name}{p.id === playerId ? ' · you' : ''}</strong>
          <small>{entry && matchStreak(entry, revealed) > 1 ? `${matchStreak(entry, revealed)} in a row · ` : ""}{entry?.status === 'solved' ? 'Got it!' : entry?.ready ? 'Ready' : entry?.status === 'out' ? 'Listening to the reveal' : wave ? 'Hello there!' : !match ? 'Ready to listen' : 'Listening…'}</small>
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
      data-difficulty="easy"
      onClick={event => {
        const target = event.target instanceof Element ? event.target.closest('button') : null;
        if (target && !target.disabled && !playing && !target.closest('.match-controls, .match-album, .noot-party')) playTap();
      }}
    >
      <header className="match-header">
        <button className="profile-edit" aria-pressed={sounds} onClick={() => {setSounds(!sounds);setButtonSounds(!sounds);}}>Sounds {sounds ? 'on' : 'off'}</button>
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
          onClick={copy}
          aria-label="Copy invite link"
        >
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
              <span>{onlineCount}/8</span>
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
                <fieldset className="match-host-filters">
                  <legend>Song mix</legend>
                  {([{key:'era', label:'Era', values:MATCH_ERAS}, {key:'genre',label:'Genre',values:MATCH_GENRES}, {key:'country',label:'Country',values:MATCH_COUNTRIES}] as const).map(({key,label,values}) => <label className="match-difficulty" key={key}>
                    {label}<select value={filters[key] ?? ''} onChange={e => setFilters(current => ({...current, [key]: e.target.value || undefined}))}>
                      <option value="">All {key === "country" ? "countries" : `${label.toLowerCase()}s`}</option>
                      {values.map(value => <option key={value} value={value}>{({modern:'2020s',classics:'Classics',PH:'Philippines',US:'United States',GB:'United Kingdom',KR:'South Korea',JP:'Japan','hip-hop':'Hip-hop','r&b':'R&B'} as Record<string,string>)[value] ?? value[0].toUpperCase()+value.slice(1)}</option>)}
                    </select>
                  </label>)}
                  <small>One shared mix for everyone. Filters stay fixed for the match.</small>
                </fieldset>
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
              {Object.values(filters).filter(Boolean).length ? "Custom mix" : "Global mix"} · same intro · 90 seconds per song
              <br />
              {carryScores
                ? "Points carry into the next match."
                : "Each match starts at zero."}{" "}
              Equal scores share a rank.
            </p>
            {isHost ? (
              <button
                className="match-primary"
                disabled={onlineCount < 2 || pending || !connected}
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
                  : onlineCount < 2
                    ? "Invite a friend to start"
                    : "Start the match"}
                <ArrowRight size={18} />
              </button>
            ) : (
              <p className="match-wait">Waiting for the host to start…</p>
            )}
            <button className="match-invite" onClick={copy}>
              {copied ? "Invite copied" : "Copy invite link"}
              <Copy size={15} />
            </button>
          </section>
        </div>
      ) : (
        <>
          <div className="match-progress">
            <span>
              {finished
                ? "Match complete"
                : `Song ${String(match.number).padStart(2, "0")} / ${match.length ?? MATCH_LENGTH}`}
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
            <span>{match.difficulty} · global mix</span>
          </div>
          <div className="match-layout">
            <section className="match-stage">
              <div className="match-stage-title">
                <span className="match-kicker">
                  {finished
                    ? "Final standings"
                    : revealed
                      ? "The song was"
                      : !me
                        ? "You’re spectating"
                        : me.status === "solved"
                          ? "Locked in. Nice ears."
                          : me.status === "out"
                            ? "Let’s hear from the others"
                            : "Trust your ears"}
                </span>
                <h1>
                  {finished
                    ? entries.filter((p) => p.points === entries[0]?.points)
                        .length > 1
                      ? "A shared victory."
                      : `${entries[0]?.name} takes it.`
                    : revealed
                      ? match.answer?.title
                      : countdown > 0
                        ? `Ready in ${countdown}…`
                        : me?.status === "solved"
                          ? "You’ve got it."
                          : me?.status === "out"
                            ? "Sit tight, music buddy."
                            : "How little do you need?"}
                </h1>
                {revealed && <p>{match.answer?.artist}</p>}
              </div>
              <div className="match-theatre">
                <div className="match-mascot mascot">
                  <Noot3D
                    pose={
                      solveFresh
                        ? latestSolve?.id === playerId
                          ? "cheer"
                          : "hover"
                        : helloActive
                          ? "hover"
                          : mascotPose
                    }
                    onRuler={revealed}
                    difficulty={match.difficulty}
                    theme={theme}
                    headgear={preferences.headgear}
                    mood={preferences.mood}
                    eventId={
                      stage +
                      match.number * 10 +
                      (solveFresh ? (latestSolve?.solvedAt ?? 0) : 0)
                    }
                  />
                </div>
                {revealed && (
                  <button
                    className="match-album"
                    onClick={play}
                    aria-label={
                      playing ? "Stop revealed song" : "Play revealed song"
                    }
                  >
                    {match.answer?.albumArt ? <img
                      src={match.answer.albumArt}
                      alt={`${match.answer.title} album cover`}
                    /> : <Headphones size={32} />}
                    <span>
                      {playing ? <Pause size={18} /> : <Play size={18} />}
                    </span>
                  </button>
                )}
                <div className="match-floor" />
              </div>
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
                      aria-label={`${remaining} seconds remaining`}
                    >
                      {Math.floor(remaining / 60)}:
                      {String(remaining % 60).padStart(2, "0")}
                      <small>round remaining</small>
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
                          guess(query);
                        }}
                      >
                        <input
                          aria-label="Name the song"
                          placeholder="Name the song…"
                          maxLength={200}
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          autoComplete="off"
                          disabled={pending}
                        />
                        <button
                          aria-label="Submit guess"
                          disabled={pending || !query.trim()}
                        >
                          <ArrowRight size={20} />
                        </button>
                        {results.length > 0 && (
                          <ul className="match-suggestions">
                            {results.map((r) => (
                              <li key={r.id}>
                                <button
                                  type="button"
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
                      </form>
                      <button
                        className="match-skip"
                        onClick={skip}
                        disabled={pending}
                      >
                        <SkipForward size={16} />
                        {stage === 4 ? "Pass" : "Skip"}
                      </button>
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
                        ? "Not that one. A little more of the song is unlocked."
                        : canPlay
                          ? "Name the full song title. Each skip or miss costs 200 possible points. Streaks celebrate consistency without bonus points."
                          : "")}
                  </p>
                </>
              ) : (
                <div className="match-recap">
                  <button className="match-reveal-play" onClick={play}>
                    {playing ? <Pause size={18}/> : <Play size={18}/>}
                    {playing ? 'Pause song' : 'Play revealed song'}
                  </button>
                  {audioError && <p className="match-feedback" role="alert">{audioError}</p>}
                  <strong>
                    {me ? `+${me.delta.toLocaleString()}` : "Good listening."}
                    <small>{me ? "this song" : ""}</small>
                  </strong>
                  <p>
                    {finished
                      ? `${match.length ?? 10} songs complete. ${me ? `You finished #${myRank} with ${me.points.toLocaleString()} points.` : ""}`
                      : me?.status === "solved"
                        ? `Named at ${MATCH_STAGES[me.stage]} seconds. ${ahead ? `${ahead.points - me.points} points to catch ${ahead.name}.` : "You’re in the lead."}`
                        : "A fresh song is a fresh chance."}
                  </p>
                  {me ? (
                    <div className="match-ready">
                      <p className="match-waiting" role="status">
                        {me.ready ? (() => { const waiting = match.entries.filter(p => !p.ready && players.some(q => q.id === p.id && q.connected)); return waiting.length ? `Waiting for ${waiting.map(p => p.name).join(", ")}.` : table.matchError ? "The next song couldn’t load. Try again when you’re ready." : "Everyone is ready. Preparing your next song…"; })() : "Take a moment. The next song starts when everyone is ready."}
                      </p>
                      <button
                        className="match-primary"
                        disabled={
                          pending || !connected || (Boolean(me.ready) && match.entries.some(p => !p.ready && players.some(q => q.id === p.id && q.connected))) || (finished && onlineCount < 2)
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
                            ? match.entries.some(p => !p.ready && players.some(q => q.id === p.id && q.connected)) ? "Ready · waiting for everyone" : "Try loading next song"
                            : finished
                              ? "Ready for another match"
                              : "Ready for next song"}
                        <Check size={17} />
                      </button>
                      <small>
                        {
                          match.entries.filter(
                            (p) =>
                              p.ready &&
                              players.some((q) => q.id === p.id && q.connected),
                          ).length
                        }{" "}
                        /{" "}
                        {
                          match.entries.filter((p) =>
                            players.some((q) => q.id === p.id && q.connected),
                          ).length
                        }{" "}
                        ready · connected players move on together
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
              {companion}
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
                    <small>Same points for the same clip.</small>
                  </span>
                )}
              </div>
              <div className="match-section-heading">
                <h2>{finished ? "Final scores" : "The race"}</h2>
                <Users size={17} />
              </div>
              <p className="match-board-target">
                {ahead
                  ? `${ahead.points - me!.points} points to catch ${ahead.name}`
                  : me
                    ? "Keep that lead. Every song counts."
                    : "Cheer them on."}
              </p>
              <ol>
                {entries.map((p) => {
                  const rank =
                    entries.findIndex((e) => e.points === p.points) + 1;
                  const online = players.some(
                    (e) => e.id === p.id && e.connected,
                  );
                  return (
                    <li key={p.id} data-you={p.id === playerId}>
                      <span className="match-rank">
                        {rank === 1 ? <Trophy size={18} /> : rank}
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
                        <p>
                          {!online
                            ? "Reconnecting"
                            : revealed && p.ready
                              ? "Ready for next song"
                              : p.status === "solved"
                                ? `✓ Named it · +${p.delta}`
                                : p.status === "out"
                                  ? "Finished listening"
                                  : p.lastAction === "skip"
                                    ? `Skipped → ${MATCH_STAGES[p.stage]}s`
                                    : p.lastAction === "miss"
                                      ? `Trying ${MATCH_STAGES[p.stage]}s`
                                      : "Listening"}
                        </p>
                        <div className="match-player-stages">
                          {MATCH_STAGES.map((_, i) => (
                            <i
                              key={i}
                              data-lit={i <= p.stage}
                              data-solved={p.status === "solved"}
                            />
                          ))}
                        </div>
                      </div>
                      <b>{p.points.toLocaleString()}</b>
                    </li>
                  );
                })}
              </ol>
              <div className="match-board-note">
                <Check size={15} />
                <p>
                  Same song. Same chances.
                  <br />
                  Your skips only change your clip.
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
      <footer className="match-footer">
        <span>Made for music. Better with company.</span>
        <span>No speed bonus. Just good ears.</span>
      </footer>
    </main>
  );
}

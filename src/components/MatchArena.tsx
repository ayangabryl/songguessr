import { useSongSearch } from '../hooks/useSongSearch'
import { SongSuggestions } from './SongSuggestions'
import { scrollSongOption } from '../lib/song-search-scroll'
import { SongIdentity } from './SongIdentity'
import { HostMix } from './HostMix'
import { activeFilterCount, type CatalogFilters } from '../lib/filters'
import { audioSrcMatches } from '../lib/audio-playback'
import { buttonSoundsEnabled, setButtonSounds } from "../lib/ui-audio";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
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
  matchPoints,
  matchRank,
  MATCH_STAGES,
  type MatchDifficulty,
} from "../../shared/match";
import { MAX_SITTING_PLAYERS } from "../../shared/sitting";
import type { useSitting } from "../hooks/useSitting";
import { ScoreNumber } from "./ScoreNumber";
import { MatchStandings } from "./MatchStandings";
import { NootParty } from "./NootParty";
import type { NootParticipant } from "../lib/noot/social-world";
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

  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
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
  const suggestionsRef = useRef<HTMLDivElement | null>(null);
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
  const songSearch = useSongSearch(query, canPlay);
  const results = songSearch.results;
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
    if (me?.ready) setPending(false);
  }, [me?.ready]);
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
  const place = matchRank(entries, playerId);
  const myRank = place.rank;
  const points = matchPoints(match ?? undefined);
  const solved = entries
    .filter((p) => p.status === "solved")
    .sort((a, b) => (a.solvedAt ?? 0) - (b.solvedAt ?? 0));
  const timedOut = Boolean(
    revealed &&
      solved.length === 0 &&
      match?.entries.some((p) => p.lastAction === "timeout"),
  );
  const tiedOnZero = Boolean(me && entries.every((p) => p.points === 0));
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
  const party = players.filter(p => p.connected)
  const partyParticipants: NootParticipant[] = party.map(p => {
    const entry = entries.find(e => e.id === p.id);
    const event = p.greeting && now + table.clockOffset - p.greeting.at < 5000
      ? {id:p.greeting.at, type:'greeting' as const, from:p.greeting.from}
      : entry?.solvedAt ? {id:entry.solvedAt,type:'success' as const}
      : entry?.lastAction === 'miss' ? {id:`${match?.roundId}:${entry.stage}`,type:'frustration' as const} : undefined;
    return {id:p.id,name:p.name,state:{...(p.appearance ?? {}),
      pose:entry?.status === 'solved' ? 'idle' : p.id === playerId && playing ? 'play' : 'idle',
      eventId:entry?.solvedAt ?? p.joinedAt,difficulty:match?.difficulty ?? (difficulty === 'mixed' ? 'easy' : difficulty),theme},event};
  });
  const chooseNoot = (id: string) => {
    if (id === playerId) window.dispatchEvent(new Event('open-noot-profile'));
    else { table.greet(id); }
  };
  const companion = <div className="match-noot-world">
    <NootParty participants={partyParticipants} theme={theme} onChoose={chooseNoot}/>
    <div className="match-friend-actions">{party.map(p=><button key={p.id} onClick={()=>chooseNoot(p.id)}>
      {p.id === playerId ? 'Your outfit' : `Wave to ${p.name}`}
    </button>)}</div>
  </div>;
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
        <a href="/" className="match-brand">
          <img className="wordmark-mark" src="/app-icons/noot-app-icon.png" alt="" />
          <span className="wordmark-name">SongGuessr</span>
        </a>
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
                <Trophy size={18} /> Up to 5,000 points a song
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
                      onClick={() => chooseNoot(p.id)}
                    >
                      {p.name}
                    </button>
                    {p.id === playerId && p.name.toLowerCase() !== 'you' && <small> you</small>}
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
                              ? "Name the track"
                              : "Your turn to listen"}
                </span>
                <h1 aria-label={!finished && countdown === 0 ? `${MATCH_STAGES[stage]} second clip` : undefined}>
                  {finished
                    ? entries.filter((p) => p.points === entries[0]?.points)
                        .length > 1
                      ? entries[0]?.points === 0 ? "An even match." : "A shared victory."
                      : `${entries[0]?.name} takes it.`
                    : countdown > 0
                      ? `Starts in ${countdown}`
                      : <>{MATCH_STAGES[stage]}<small>s</small></>}
                </h1>
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
                          ? points[stage].toLocaleString()
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
                        <span>{points[i]} pts</span>
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
                        onBlur={event => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchOpen(false);
                        }}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const pick = searchOpen ? results[highlight] : undefined;
                          if (pick) guess(`${pick.title} - ${pick.artist}`, pick.id);
                          else guess(query);
                        }}
                      >
                        <input
                          aria-label="Name the track"
                          placeholder="Name the track"
                          maxLength={200}
                          value={query}
                          onFocus={() => setSearchOpen(Boolean(query.trim()))}
                          onChange={(e) => {
                            setQuery(e.target.value);
                            setSearchOpen(Boolean(e.target.value.trim()));
                            setHighlight(0);
                          }}
                          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                            if (event.nativeEvent.isComposing) return;
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setSearchOpen(false);
                              return;
                            }
                            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                            event.preventDefault();
                            if (!searchOpen) { setSearchOpen(true); setHighlight(0); return; }
                            const next = event.key === "ArrowDown" ? Math.min(highlight + 1, results.length - 1) : Math.max(highlight - 1, 0);
                            setHighlight(next);
                            scrollSongOption(suggestionsRef.current, next);
                            if (next === results.length - 1) void songSearch.loadMore();
                          }}
                          autoComplete="off"
                          spellCheck={false}
                          role="combobox"
                          aria-expanded={searchOpen && Boolean(query.trim())}
                          aria-autocomplete="list"
                          aria-controls="match-suggestions"
                          aria-activedescendant={
                            searchOpen && results[highlight]
                              ? `match-suggestions-${results[highlight].id}`
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
                        {query.trim() && searchOpen && <SongSuggestions id="match-suggestions" search={songSearch}
                          highlight={highlight} onHighlight={setHighlight} scrollRef={suggestionsRef}
                          onSelect={result => { setSearchOpen(false); guess(`${result.title} - ${result.artist}`, result.id); }} />}
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
                  <p className="round-result-banner" data-perfect={me?.delta === points[0]}>
                    {me?.delta === points[0] ? 'Perfect listen.' : me?.status === 'solved' ? 'That’s the track.' : 'One for your next listen.'}
                  </p>
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
                        {me ? <ScoreNumber value={me.delta} prefix="+"/> : "Good listening."}
                        <small>{me ? "this song" : ""}</small>
                      </strong>
                      <p className="match-outcome">
                        {finished
                          ? `${match.length ?? 10} songs complete. ${me ? `You finished ${place.tied ? "tied " : ""}#${myRank} with ${me.points.toLocaleString()} points.` : ""}`
                          : me?.status === "solved"
                            ? `Named at ${MATCH_STAGES[me.stage]} seconds.${ahead ? ` ${ahead.points - me.points} to catch ${ahead.name}.` : place.tied ? " You’re tied for the lead." : " You’re in the lead."}`
                            : timedOut
                              ? "Nobody named it in time."
                              : solved.length ? `${solved.map(p=>p.name).join(", ")} named it. Your next song is a fresh chance.` : "Nobody named this one."}
                      </p>
                    </div>
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
                              : "Ready up"}
                        {me.ready && !pending ? <Check size={17} /> : <ArrowRight size={17} />}
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
                  <div className="match-recap-party">
                    {companion}
                  </div>
                </div>
              )}
            </section>
            <aside className="match-board">
              {!revealed && solved.length > 0 && (
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
              <MatchStandings entries={entries} playerId={playerId} revealed={revealed} online={party.map(p=>p.id)} onChoose={chooseNoot}/>
              <p className="race-tie-note">Same clip, same points. Equal scores share a place.</p>
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

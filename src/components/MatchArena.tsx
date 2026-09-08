import { MatchResults } from './MatchResults'
import { NootAvatar } from './NootAvatar';
import { SittingHistory } from './SittingHistory'
import { matchSittingHistory } from '../lib/match-history'
import { useSongSearch } from '../hooks/useSongSearch'
import { SongSuggestions } from './SongSuggestions'
import { scrollSongOption } from '../lib/song-search-scroll'
import { Ruler } from './Ruler'
import { PlayControlIcon, SkipIcon } from './Icons'
import { progressAtElapsedSeconds } from '../lib/stage-progress'
import type { SearchResult } from '../lib/api'
import type { RoundMark } from './Game'
import { SongIdentity } from './SongIdentity'
import { HostMix } from './HostMix'
import { activeFilterCount, type CatalogFilters } from '../lib/filters'
import { audioSrcMatches } from '../lib/audio-playback'
import { createMatchAudioPlayer, type MatchAudioState } from '../lib/match-audio'
import { buttonSoundsEnabled, setButtonSounds } from "../lib/ui-audio";
import { useEffect, useRef, useState, type KeyboardEvent, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Headphones,
  Play,
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
import { MatchScoreboard } from "./MatchScoreboard";
import { NootParty } from "./NootParty";
import type { NootParticipant } from "../lib/noot/social-world";
import "../match.css";
import { loadVolume } from "../lib/game-state";
import { useNootPreferences } from '../lib/noot/preferences';

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
  const [appearance] = useNootPreferences();
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
  const [selectedTrack, setSelectedTrack] = useState<SearchResult | null>(null);
  const [marks, setMarks] = useState<RoundMark[]>([]);
  const playhead = useRef<HTMLDivElement>(null);
  const rulerState = useRef({ stage: 0, offset: 0 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [hearReveal, setHearReveal] = useState(false);
  const [audioState, setAudioState] = useState<MatchAudioState>('idle'),
    [audioError, setAudioError] = useState(""),
    [pending, setPending] = useState(false),
    [copied, setCopied] = useState(false);
  const playing = audioState === 'playing';
  const audio = useRef<HTMLAudioElement | null>(null);
  const player = useRef<ReturnType<typeof createMatchAudioPlayer> | null>(null);
  const revealedRef = useRef(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const autoClipRound = useRef<string | null>(null);
  const resumeAt = useRef<number | null>(null);
  const skipContinuation = useRef<{ roundId: string; stage: number } | null>(null);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  const me = match?.entries.find((p) => p.id === playerId);
  const stage = me?.stage ?? 0;
  rulerState.current = { stage, offset: match?.offset ?? 0 };
  const isHost = hostId === playerId,
    connected = table.status === "live";
  const revealed = Boolean(match && match.phase !== "playing"),
    finished = match?.phase === "finished";
  useEffect(() => {
    if (!revealed || document.querySelector('[aria-modal="true"]')) return
    resultHeading.current?.focus({preventScroll:true})
    resultHeading.current?.scrollIntoView({block:'start'})
  }, [revealed, match?.roundId]);
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
  const songSearch = useSongSearch(query, canPlay, match?.filters?.playlist?.id);
  const results = songSearch.results;
  revealedRef.current = revealed;
  const stop = () => { resumeAt.current = null; player.current?.stop(); };
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    setPending(false);
    setQuery("");
    setSelectedTrack(null);
    setSearchOpen(false);
    setHighlight(0);
    const skipped = skipContinuation.current;
    const acknowledgedSkip = skipped && skipped.roundId === match?.roundId && stage > skipped.stage && me?.status === 'playing';
    if (match?.phase === "playing" && !acknowledgedSkip) stop();
  }, [match?.roundId, stage, me?.status]);
  useEffect(() => {
    setHearReveal(false);
    autoClipRound.current = null;
    setMarks([]);
  }, [match?.roundId]);
  useEffect(() => {
    if (!me || !['miss', 'skip'].includes(me.lastAction) || (stage === 0 && me.status !== 'out')) return;
    const mark: RoundMark = { kind: me.lastAction === 'miss' ? 'miss' : 'skip', stage: MATCH_STAGES[me.status === 'out' ? stage : stage - 1] };
    setMarks(old => old.some(m => m.stage === mark.stage) ? old : [...old, mark]);
  }, [stage, me?.lastAction, me?.status]);
  useEffect(() => {
    if (table.matchError) { setPending(false); skipContinuation.current = null; }
  }, [table.matchError]);
  useEffect(() => {
    setPending(false);
  }, [me?.ready]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => { setPending(false); skipContinuation.current = null; }, 4000);
    return () => clearTimeout(timer);
  }, [pending]);
  useEffect(() => {
    const el = audio.current!;
    const controller = createMatchAudioPlayer(el, {
      state: setAudioState,
      tick: seconds => {
        const { stage, offset } = rulerState.current;
        if (playhead.current) playhead.current.style.width = `${progressAtElapsedSeconds(MATCH_STAGES, stage, seconds - offset)}%`;
      },
      heard: () => setHearReveal(false),
      error: error => {
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          if (revealedRef.current) setHearReveal(true);
          else setAudioError('Press play to hear the clip.');
        } else setAudioError('The audio couldn’t load. Tap play to retry.');
      },
    });
    player.current = controller;
    return () => {
      controller.dispose();
      el.removeAttribute('src');
      el.load();
      player.current = null;
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
    if (!canPlay && !revealed) stop();
  }, [canPlay, revealed]);
  useEffect(() => {
    if (!revealed || !match?.audio || !audio.current) return;
    setHearReveal(false);
    void startPlayback();
    return () => stop();
  }, [revealed, match?.roundId, match?.audio]);
  useEffect(() => {
    if (!canPlay || !match?.audio || autoClipRound.current === match.roundId) return;
    autoClipRound.current = match.roundId;
    void startPlayback();
  }, [canPlay, match?.roundId, match?.audio]);
  useEffect(() => {
    const skipped = skipContinuation.current;
    if (!skipped) return;
    if (!match || match.roundId !== skipped.roundId || revealed || me?.status !== 'playing' || !connected) {
      skipContinuation.current = null;
      return;
    }
    if (stage <= skipped.stage || !canPlay) return;
    skipContinuation.current = null;
    // Only the acknowledged skip unlocks more audio; roster updates never replay it.
    if (player.current?.extendTo(match.offset + MATCH_STAGES[stage])) return;
    // A clip that finished while awaiting acknowledgement resumes at its cut;
    // paused or not-yet-started clips resume where the listener actually was.
    const cursor = Math.max(0, (player.current?.position ?? match.offset) - match.offset);
    void startPlayback(Math.min(MATCH_STAGES[skipped.stage], cursor));
  }, [stage, canPlay, connected, revealed, match?.roundId, me?.status]);
  function play() {
    skipContinuation.current = null;
    if (audioState === 'loading') { stop(); return; }
    if (playing) {
      const elapsed = Math.max(0, (audio.current?.currentTime ?? 0) - (match?.offset ?? 0));
      player.current?.stop();
      resumeAt.current = elapsed < (revealed ? 15 : MATCH_STAGES[stage]) - .01 ? elapsed : null;
      return;
    }
    const start = resumeAt.current ?? 0;
    resumeAt.current = null;
    void startPlayback(start);
  }
  async function startPlayback(start = 0) {
    if (!match || !player.current) return;
    setAudioError('');
    await player.current.play({
      start: match.offset + start,
      duration: (revealed ? 15 : MATCH_STAGES[stage]) - start,
      volume: loadVolume(),
    });
  }
  function guess(value: string, trackId?: string) {
    if (!canPlay || pending || !value.trim() || !match) return;
    skipContinuation.current = null;
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
    resumeAt.current = null;
    skipContinuation.current = { roundId: match.roundId, stage };
    // Keep the authorized clip playing while the server processes the skip.
    if (stage === MATCH_STAGES.length - 1) stop();
    setPending(true);
    sendMatch({ type: "match-skip", roundId: match.roundId, stage });
  }
  const entries = match
    ? [...match.entries].sort((a, b) => b.points - a.points)
    : [];
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
  const party = players.filter(p => p.connected)
  const partyParticipants: NootParticipant[] = party.map(p => {
    const entry = entries.find(e => e.id === p.id);
    const event = p.greeting && now + table.clockOffset - p.greeting.at < 5000
      ? {id:p.greeting.at, type:'greeting' as const, from:p.greeting.from}
      : entry?.solvedAt ? {id:entry.solvedAt,type:'success' as const}
      : entry?.lastAction === 'miss' ? {id:`${match?.roundId}:${entry.stage}`,type:'frustration' as const} : undefined;
    return {id:p.id,name:p.name,state:{...(p.id === playerId ? appearance : p.appearance ?? {}),
      pose:entry?.status === 'solved' ? 'idle' : (p.id === playerId ? playing : p.activity?.action === 'listening' && now + table.clockOffset - p.activity.at < 60000) ? 'play' : 'idle',
      eventId:entry?.solvedAt ?? p.joinedAt,difficulty:match?.difficulty ?? (difficulty === 'mixed' ? 'easy' : difficulty),theme},event};
  });
  const chooseNoot = (id: string) => {
    if (id === playerId) window.dispatchEvent(new Event('open-noot-profile'));
    else { table.greet(id); }
  };
  const sittingHistory = match ? matchSittingHistory(match, playerId) : [];
  useEffect(() => {
    if (table.live) table.reportActivity(playing ? 'listening' : 'idle', MATCH_STAGES[stage])
  }, [playing, stage, table.live, table.reportActivity])
  const companion = <NootParty participants={partyParticipants} theme={theme} network={table.nootChannel} onChoose={chooseNoot}
    labelAction={id => id === playerId ? 'Your outfit' : `Wave to ${party.find(p => p.id === id)?.name ?? 'your friend'}`}/>;
  const onlineCount = players.filter((p) => p.connected).length;
  async function copy() {
    try {
      await navigator.clipboard.writeText(table.inviteUrl ?? table.code ?? "");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  function selectTrack(result: SearchResult) {
    setSelectedTrack(result); setQuery(`${result.title} — ${result.artist}`); setSearchOpen(false);
  }
  function searchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') { setSearchOpen(false); return; }
    if (event.key === 'Enter' && searchOpen && results.length) {
      event.preventDefault(); selectTrack(results[highlight] ?? results[0]); return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!query.trim() || selectedTrack) return;
    if (!searchOpen) { setSearchOpen(true); setHighlight(0); return; }
    const next = event.key === 'ArrowDown' ? Math.min(highlight + 1, results.length - 1) : Math.max(highlight - 1, 0);
    setHighlight(Math.max(0, next)); scrollSongOption(suggestionsRef.current, Math.max(0, next));
    if (next === results.length - 1) void songSearch.loadMore();
  }
  const roundLabel = !match ? 'Your table' : finished ? 'Match complete' : `Song ${match.number} of ${match.length ?? MATCH_LENGTH}`;
  return (
    <main className="app-shell match-room" data-theme={theme}
      data-difficulty={match?.difficulty ?? (difficulty === 'mixed' ? 'easy' : difficulty)}
      data-sound-playing={audioState !== 'idle'} data-audio-state={audioState}>
      <audio ref={audio} preload="auto" hidden aria-hidden="true" />
      {mixOpen && <HostMix value={filters} difficulty={difficulty === 'mixed' ? 'easy' : difficulty}
        onClose={() => setMixOpen(false)} onApply={value => { setFilters(value); setMixOpen(false); }}/>}
      <header className="match-header">
        <a href="/" className="match-brand"><img className="wordmark-mark" src="/app-icons/noot-app-icon.png" alt=""/><span className="wordmark-name">SongGuessr</span></a>
        <button className="match-code" onClick={() => void copy()} aria-label={`Share table code ${table.code ?? ''}`}>
          <span className="match-code-label">Table</span> {table.code}<Copy size={14}/>{copied && <small role="status">Copied</small>}
        </button>
        <div className="match-toolbar">
          <button className="profile-edit" onClick={() => window.dispatchEvent(new Event('open-noot-profile'))}>Your Noot</button>
          <button className="match-icon-btn" aria-pressed={sounds} aria-label={sounds ? 'Button sounds on' : 'Button sounds off'}
            onClick={() => { setSounds(!sounds); setButtonSounds(!sounds); }}>{sounds ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>
          <button className="match-back" onClick={() => { stop(); table.leave(); }}><ArrowLeft size={16}/><span>Leave table</span></button>
        </div>
      </header>
      {!connected && <p className="match-notice" role="status">Reconnecting. Your place is saved. <button onClick={table.reconnect}>Reconnect</button></p>}
      {table.matchError && <p className="match-notice" role="alert">{table.matchError}</p>}
      <div className="match-experience" data-phase={!match ? 'lobby' : finished ? 'finished' : revealed ? 'reveal' : 'playing'}>
        <div className="match-intro">
          <div className="match-progress"><span>{roundLabel}</span>{match && <span className="match-level">{match.difficulty}</span>}
            {match && <span className="match-progress-track" role="img" aria-label={`${match.number} of ${match.length ?? MATCH_LENGTH} songs`}>
              {Array.from({length: match.length ?? MATCH_LENGTH}, (_,i) => <i key={i} data-done={i < match.number - 1 || finished} data-current={i === match.number - 1}/>)}
            </span>}
          </div>
          {!match ? <><h1>Good music.<br/>Better together.</h1><p className="match-lobby-description">Same song. Your own ears. Invite a friend, then press play.</p></>
            : finished ? <><h1 ref={resultHeading} tabIndex={-1}>{entries.filter(p => p.points === entries[0]?.points).length > 1 ? entries[0]?.points === 0 ? 'An even match.' : 'A shared victory.' : `${entries[0]?.name} takes it.`}</h1>
              {me && <p className="match-final-summary"><span>{place.tied ? 'Tied ' : ''}#{myRank}</span><span aria-hidden="true">·</span><strong><ScoreNumber value={me.points}/> <small>pts</small></strong></p>}</>
            : revealed ? <h1 ref={resultHeading} tabIndex={-1}>Song revealed.</h1>
            : <div className="match-stage-head"><h1 className="match-numeral" aria-label={`${MATCH_STAGES[stage]} second clip`}>{MATCH_STAGES[stage]}<small>s</small></h1>
              <span className="match-readout" role="status">{revealed ? me?.status === 'solved' ? 'That’s the track.' : 'One for your next listen.' : countdown > 0 ? `Starts in ${countdown}` : !me ? 'You’re spectating' : me.status === 'solved' ? 'Locked in. Nice ears.' : me.status === 'out' ? 'Waiting for the others' : playing ? 'Listening…' : ''}</span>
            </div>}
        </div>
        <div className="match-noot-world" data-large-party={party.length > 6} style={{'--party-width': `${party.length * 64}px`} as CSSProperties}>{companion}</div>
        <section className="match-content" aria-label={!match ? 'Table setup' : revealed ? 'Song result' : 'Listen and guess'}>
          {!match ? <>
            <div className="match-section-heading"><h2>Your listening party</h2><span>{onlineCount}/{MAX_SITTING_PLAYERS}</span></div>
            <ul className="match-guests">{players.map(p => <li key={p.id}>
              <NootAvatar appearance={p.id === playerId ? appearance : p.appearance} difficulty={difficulty === 'mixed' ? 'easy' : difficulty}/><button className="friend-name" onClick={() => chooseNoot(p.id)}>{p.name}{p.id === playerId && p.name.toLowerCase() !== 'you' && <small>you</small>}</button><span>{p.id === hostId ? 'Host' : p.connected ? 'Ready' : 'Away'}</span>
            </li>)}</ul>
            {isHost ? <div className="match-options">
              <label className="match-difficulty">Difficulty<select value={difficulty} onChange={e => setDifficulty(e.target.value as MatchDifficulty | 'mixed')}>
                {['mixed','easy','medium','hard','expert','impossible'].map(d => <option key={d} value={d}>{d === 'mixed' ? 'All difficulties' : d[0].toUpperCase() + d.slice(1)}</option>)}
              </select></label>
              <label className="match-difficulty">Songs<select value={length} onChange={e => setLength(Number(e.target.value))}>{[5,10,15,20].map(n => <option key={n} value={n}>{n} songs</option>)}</select></label>
              <button className="match-mix" onClick={() => setMixOpen(true)}><span>Mix · {filters.playlist?.name ?? 'playlist, artists & genres'}{activeFilterCount(filters) > 0 ? ` (${activeFilterCount(filters)})` : ''}</span><ArrowRight size={16}/></button>
              <details className="match-more"><summary>Match options</summary>
                <label className="match-difficulty">After a match<select value={String(carryScores)} onChange={e => setCarryScores(e.target.value === 'true')}><option value="false">Reset scores</option><option value="true">Keep points</option></select></label>
              </details>
            </div> : <p className="match-fine">The host chooses the mix. You’ll hear the same song.</p>}
            <p className="match-fine">90 seconds per song. Up to {points[0]} points. Each later clip earns one less.</p>
            {isHost ? onlineCount < 2 ? <button className="match-primary" onClick={() => void copy()}>{copied ? 'Invite copied' : 'Invite a friend'}<Copy size={17}/></button>
              : <button className="match-primary" disabled={pending || !connected} onClick={() => { setPending(true); sendMatch({type:'match-start',difficulty,length,carryScores,filters}); }}>{pending ? 'Finding your first song…' : 'Start the match'}<ArrowRight size={18}/></button>
              : <p className="match-wait" role="status">Waiting for the host to start…</p>}
          </> : <>
            {me && !revealed && <Ruler stages={MATCH_STAGES} stageIndex={stage} marks={me.attempts ?? marks} status={revealed || me?.status === 'out' ? me?.status === 'solved' ? 'won' : 'lost' : me?.status === 'solved' ? 'won' : 'playing'}
              solvedStage={me.status === 'solved' ? MATCH_STAGES[stage] : null} playheadRef={playhead} isPlaying={playing}
              description={me.lastAction === 'timeout' ? `Time ran out with ${MATCH_STAGES[stage]} seconds unlocked, on try ${stage + 1}.`
                : me.status === 'solved' ? `Named at ${MATCH_STAGES[stage]} seconds after ${stage + 1} ${stage === 0 ? 'try' : 'tries'}.` : undefined}/>}
            {!revealed ? <>
              <div className={`match-dock transport-row${playing ? ' is-playing' : ''}`}>
                <button className="play-control" onClick={play} disabled={!canPlay} aria-busy={audioState === 'loading'}
                  aria-label={audioState === 'loading' ? 'Cancel loading clip' : playing ? 'Pause clip' : `Play ${MATCH_STAGES[stage]} second clip`}>
                  <PlayControlIcon state={audioState === 'loading' ? 'loading' : playing ? 'pause' : 'play'}/>
                </button>
                <form className="guess-form" onSubmit={event => { event.preventDefault(); if (selectedTrack) guess(`${selectedTrack.title} - ${selectedTrack.artist}`, selectedTrack.id); else if (searchOpen && results.length) selectTrack(results[highlight] ?? results[0]); }}>
                  <div className={`search-wrap${selectedTrack ? ' selected' : ''}`} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchOpen(false); }}>
                    <span className="search-icon" aria-hidden="true"/>
                    <input aria-label="Name the track" placeholder="Name the track" maxLength={200} value={query}
                      onChange={event => { setSelectedTrack(null); setQuery(event.target.value); setSearchOpen(Boolean(event.target.value.trim())); setHighlight(0); }}
                      onFocus={() => { if (!selectedTrack && query.trim()) setSearchOpen(true); }} onKeyDown={searchKey}
                      autoComplete="off" spellCheck={false} role="combobox" aria-expanded={searchOpen && Boolean(query.trim())}
                      aria-autocomplete="list" aria-controls="match-suggestions" aria-activedescendant={searchOpen && results[highlight] ? `match-suggestions-${results[highlight].id}` : undefined}
                      disabled={!canPlay || pending}/>
                    {query.trim() && searchOpen && <SongSuggestions id="match-suggestions" search={songSearch} highlight={highlight} onHighlight={setHighlight} scrollRef={suggestionsRef} onSelect={selectTrack}/>}
                  </div>
                  {selectedTrack ? <button type="submit" className="btn btn-primary guess-button" disabled={!canPlay || pending}>{pending ? 'Checking…' : 'Guess'}</button>
                    : <button type="button" className="btn btn-quiet skip-button" onClick={skip} disabled={!canPlay || pending} title={stage === 4 ? 'Give up this song' : 'Hear a longer clip'}><SkipIcon/><span>{stage === 4 ? 'Pass' : 'Skip'}</span></button>}
                </form>
              </div>
              <div className="match-round-meta"><span>{!me ? 'Watching this round' : me.status === 'out' ? 'Song passed' : me.status === 'solved' ? <><strong>+{me.delta.toLocaleString()}</strong> {me.delta === 1 ? 'point' : 'points'} secured</> : <><strong>{points[stage].toLocaleString()}</strong> {points[stage] === 1 ? 'point' : 'points'} available</>}</span>
                <span className="match-clock" data-urgent={remaining <= 15} aria-label={`${remaining} seconds left in this round`}>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')} <small>left</small></span>
              </div>
              <p className="match-feedback" role="status">{audioError || (audioState === 'loading' ? 'Loading the clip…' : '') || (countdown > 0 ? 'Everyone starts together.' : !me ? 'Join the next match to play.' : me.status !== 'playing' ? `${match.entries.filter(p => p.status === 'playing').length} still listening. The answer reveals together.` : me.lastAction === 'miss' ? 'Not that one. A longer clip is ready.' : selectedTrack ? 'Ready when you are. Confirm your guess.' : 'Press play, then name the track. Skip for a longer clip.')}</p>
            </> : <div className="match-recap round-answer">
              <div className="match-answer-row">{match.answer && <button className="match-album" onClick={play} aria-label={playing ? 'Pause song' : 'Play song'}>{match.answer.albumArt ? <img src={match.answer.albumArt} alt=""/> : <Headphones size={32}/>}<span><PlayControlIcon state={playing ? 'pause' : 'play'}/></span></button>}
                <div className="match-answer-copy">{match.answer && <SongIdentity title={match.answer.title} artist={match.answer.artist}/>}
                  {!finished && <p className="match-score-beat"><strong>{me ? <ScoreNumber value={me.delta} prefix="+"/> : 'Good listening.'}</strong>{me && <span>this song</span>}</p>}
                  {!finished && <p className="match-outcome">{me?.status === 'solved' ? `Named at ${MATCH_STAGES[me.stage]} seconds.` : timedOut ? 'Nobody named it in time.' : solved.length ? `${solved.length} of ${entries.length} named it.` : 'One to remember.'}</p>}
                </div>
              </div>
              {hearReveal && <button className="match-hear" onClick={play}><Play size={16}/>Tap to hear it</button>}
              {audioError && <p className="match-feedback" role="alert">{audioError}</p>}
              <MatchResults key={match.roundId} entries={entries} playerId={playerId} hostId={hostId}
                online={party.map(p=>p.id)} appearances={Object.fromEntries(players.map(p=>[p.id,p.id===playerId?appearance:p.appearance]))}
                difficulty={match.difficulty} finished={Boolean(finished)} carryScores={Boolean(match.carryScores)}
                pending={pending} connected={connected} error={table.matchError}
                onReady={()=>{setPending(true);sendMatch({type:'match-ready',roundId:match.roundId})}}
                onUnready={()=>{setPending(true);sendMatch({type:'match-unready',roundId:match.roundId})}}
                onContinue={()=>{setPending(true);sendMatch({type:'match-continue',roundId:match.roundId})}}/>

            </div>}
          </>}
        </section>
        {match && sittingHistory.length > 0 && <SittingHistory entries={sittingHistory} total={sittingHistory.reduce((sum, entry) => sum + entry.points, 0)}/>}
        {match && !revealed && <MatchScoreboard entries={entries} playerId={playerId} matchId={match.id} finished={Boolean(finished)} revealed={revealed}
          online={party.map(p => p.id)} onChoose={chooseNoot} appearances={Object.fromEntries(players.map(p => [p.id, p.id === playerId ? appearance : p.appearance]))} difficulty={match.difficulty}/>}

      </div>
    </main>
  );
}

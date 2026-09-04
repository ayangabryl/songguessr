import type { ReactNode, RefObject } from "react";
import { formatStageValue } from "../lib/game-state";
import { progressAtStageBoundary } from "../lib/stage-progress";
import type { RoundMark } from "./Game";

/**
 * The ruler: one timeline for the round.
 *
 * Stops are the enabled stages, placed with the same weighting the clip timer
 * uses, so a second of audio is the same distance everywhere on screen. The
 * unlocked span fills as tries are spent; the playhead runs along it while a
 * clip plays; every miss and skip is drawn at the stop where it happened; the
 * win is a filled dot at the stop where the track was named. Anything placed
 * above the ruler (the character, the answer's cover) is positioned with the
 * same `stopPosition()` so it stands on the stop it refers to.
 *
 * The ruler is a readout, not a control. All actions live in the transport
 * row; assistive technology gets the same state as one sentence.
 */
interface RulerProps {
  stages: number[];
  stageIndex: number;
  marks: RoundMark[];
  status: "idle" | "playing" | "won" | "lost";
  solvedStage?: number | null;
  /** Playhead element written imperatively by the clip timer (percent width). */
  playheadRef?: RefObject<HTMLDivElement | null>;
  playbackProgress?: number;
  isPlaying?: boolean;
  size?: "full" | "signature";
  children?: ReactNode;
}

/** Percent along the ruler for the stop that ends `stage`. */
export function stopPosition(stages: number[], stage: number): number {
  const index = stages.indexOf(stage);
  if (index < 0) return 0;
  return progressAtStageBoundary(stages, index + 1);
}

export function describeRuler(props: RulerProps): string {
  const { stages, stageIndex, marks, status, solvedStage } = props;
  const tries = stages.length;
  if (status === "won" && solvedStage != null) {
    return `Named at ${formatStageValue(solvedStage)} seconds after ${marks.length} ${marks.length === 1 ? "try" : "tries"}.`;
  }
  if (status === "lost") {
    return `Not named in ${tries} tries.`;
  }
  const misses = marks.filter((mark) => mark.kind === "miss").length;
  const skips = marks.filter((mark) => mark.kind === "skip").length;
  const current = stages[Math.min(stageIndex, tries - 1)] ?? 0;
  const parts = [
    `Try ${Math.min(stageIndex + 1, tries)} of ${tries}, ${formatStageValue(current)} seconds unlocked`,
  ];
  if (misses) parts.push(`${misses} ${misses === 1 ? "miss" : "misses"}`);
  if (skips) parts.push(`${skips} ${skips === 1 ? "skip" : "skips"}`);
  return `${parts.join(", ")}.`;
}

export function Ruler(props: RulerProps) {
  const {
    stages,
    stageIndex,
    marks,
    status,
    solvedStage = null,
    playheadRef,
    playbackProgress = 0,
    isPlaying = false,
    size = "full",
    children,
  } = props;

  const finished = status === "won" || status === "lost";
  const unlocked = finished
    ? 100
    : progressAtStageBoundary(stages, stageIndex + 1);

  return (
    <div
      className={`ruler ruler-${size}`}
      data-status={status}
      data-playing={isPlaying || undefined}
    >
      <div
        className="ruler-draw"
        role="img"
        aria-label={describeRuler(props)}
        data-slop-ok="3: each mark is a spent try at a stop, not ornament; the whole ruler is one labelled image, so the marks are aria-hidden on purpose"
      >
        <div className="ruler-line" aria-hidden="true" />
        <div
          className="ruler-fill"
          style={{ width: `${unlocked}%` }}
          aria-hidden="true"
        />
        {size === "full" && !finished ? (
          <div
            ref={playheadRef}
            className="ruler-head"
            style={{ width: `${playbackProgress}%` }}
            aria-hidden="true"
          />
        ) : null}
        {stages.map((stage, index) => {
          const state = finished
            ? "passed"
            : index < stageIndex
              ? "passed"
              : index === stageIndex
                ? "current"
                : "ahead";
          return (
            <span
              key={stage}
              className="ruler-stop"
              data-state={state}
              style={{ left: `${stopPosition(stages, stage)}%` }}
              aria-hidden="true"
            >
              <i />
              {size === "full" ? (
                <b>
                  {formatStageValue(stage)}
                  {index === stages.length - 1 ? " s" : ""}
                </b>
              ) : null}
            </span>
          );
        })}
        {marks.map((mark, index) => (
          <span
            key={`${mark.kind}-${mark.stage}-${index}`}
            className="ruler-mark"
            data-kind={mark.kind}
            style={{ left: `${stopPosition(stages, mark.stage)}%` }}
            aria-hidden="true"
          />
        ))}
        {status === "won" && solvedStage != null ? (
          <span
            className="ruler-mark"
            data-kind="win"
            style={{ left: `${stopPosition(stages, solvedStage)}%` }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      {children}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

/**
 * One shared temporal clock for the whole Time Machine route.
 *
 * The clock owns playback/stepping/cancellation and publishes snapshots to
 * subscribers. It never renders the map itself; layers, inspector and metrics
 * subscribe to it. All pending seek/play work is generation-guarded: a new
 * seek, pause, or step invalidates anything outstanding, so a stale request
 * can never overwrite newer temporal state.
 */

export interface ClockSnapshot {
  time: number; // 2018..2024 (year as a float while playing)
  playing: boolean;
  speed: number;
}

export type TemporalListener = (s: ClockSnapshot) => void;

export class TimeMachineClock {
  private time: number;
  private min: number;
  private max: number;
  private playing = false;
  private speed = 1;
  private raf: number | null = null;
  private last: number | null = null;
  private generation = 0;
  private listeners = new Set<TemporalListener>();

  constructor(min: number, max: number, start: number) {
    this.min = min;
    this.max = max;
    this.time = start;
  }

  subscribe(fn: TemporalListener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  snapshot(): ClockSnapshot {
    return { time: this.time, playing: this.playing, speed: this.speed };
  }

  private emit() {
    const s = this.snapshot();
    this.listeners.forEach((fn) => fn(s));
  }

  private cancelRaf() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.last = null;
  }

  play() {
    if (this.playing) return;
    if (this.time >= this.max) this.time = this.min;
    this.playing = true;
    const myGen = ++this.generation;
    const tick = (t: number) => {
      if (myGen !== this.generation || !this.playing) return;
      if (this.last !== null) {
        // 1x = one year per 1.4s
        this.time = Math.min(this.max, this.time + ((t - this.last) / 1400) * this.speed);
        if (this.time >= this.max) {
          this.pause();
          this.emit();
          return;
        }
        this.emit();
      }
      this.last = t;
      this.raf = requestAnimationFrame(tick);
    };
    this.playing = true;
    this.emit();
    this.raf = requestAnimationFrame(tick);
  }

  pause() {
    this.generation++;
    this.playing = false;
    this.cancelRaf();
    this.emit();
  }

  seek(t: number) {
    this.generation++;
    this.cancelRaf();
    this.playing = false;
    this.time = Math.min(this.max, Math.max(this.min, t));
    this.emit();
  }

  /** Preview seek during timeline drag: moves the playhead, does not commit tile loads. */
  previewSeek(t: number) {
    this.generation++;
    this.time = Math.min(this.max, Math.max(this.min, t));
    this.emit();
  }

  step(dir: 1 | -1) {
    const target = Math.round(this.time) + dir;
    if (target >= this.min && target <= this.max) this.seek(target);
  }

  jumpTo(t: number) {
    const target = Math.min(this.max, Math.max(this.min, t));
    this.seek(target);
  }

  setSpeed(s: number) {
    this.speed = s;
    this.emit();
  }

  stop() {
    this.pause();
  }

  destroy() {
    this.generation++;
    this.cancelRaf();
    this.listeners.clear();
  }
}

/** React hook binding: returns a snapshot value that re-renders on clock ticks. */
export function useClock(clock: TimeMachineClock): ClockSnapshot {
  const [, setTick] = useState(0);
  const ref = useRef(clock);
  useEffect(() => {
    ref.current = clock;
    return clock.subscribe(() => setTick((n) => n + 1));
  }, [clock]);
  return clock.snapshot();
}

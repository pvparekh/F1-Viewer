import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { BUFFER_SIZE, ClientAction, Frame, FrameBuffer, RaceMetadata } from '../types';

const GITHUB_RELEASE_BASE = import.meta.env.DEV
  ? '/gh-releases'
  : 'https://github.com/pvparekh/F1-Viewer/releases/download';

export interface RaceAsset {
  tag: string;  // GitHub Release tag, e.g. '2023-monaco'
  file: string; // filename prefix, e.g. '2023_8'
}

export interface UseRacePlaybackReturn {
  currentFrameRef: MutableRefObject<Frame | null>;
  frameBufferRef: MutableRefObject<FrameBuffer>;
  currentFrameIndex: number;
  totalFrames: number;
  currentLap: number;
  currentT: number;
  isPlaying: boolean;
  isLoading: boolean;
  isEnded: boolean;
  errorMessage: string | null;
  raceMetadata: RaceMetadata | null;
  sendAction: (action: ClientAction) => void;
}

export function useRacePlayback(race: RaceAsset | null): UseRacePlaybackReturn {
  const framesRef = useRef<Frame[] | null>(null);
  const stateRef = useRef({ frame: 0, speed: 1.0, playing: false });
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  const currentFrameRef = useRef<Frame | null>(null);
  const frameBufferRef = useRef<FrameBuffer>({
    frames: new Array(BUFFER_SIZE).fill(null),
    writeIdx: 0,
    count: 0,
  });

  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [currentLap, setCurrentLap] = useState(1);
  const [currentT, setCurrentT] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [raceMetadata, setRaceMetadata] = useState<RaceMetadata | null>(null);

  // Tick function stored in ref to avoid stale closures
  const tickRef = useRef<(timestamp: number) => void>(() => {});
  tickRef.current = (timestamp: number) => {
    const state = stateRef.current;
    const frames = framesRef.current;

    if (state.playing && frames && frames.length > 0) {
      const elapsed = timestamp - lastTickRef.current;
      const frameIntervalMs = 100 / Math.max(0.1, state.speed);

      if (elapsed >= frameIntervalMs) {
        const idx = state.frame;

        if (idx >= frames.length) {
          setIsPlaying(false);
          setIsEnded(true);
          stateRef.current.playing = false;
          rafRef.current = null;
          return; // Stop loop at race end
        }

        const frame = frames[idx];
        currentFrameRef.current = frame;

        const buf = frameBufferRef.current;
        buf.frames[buf.writeIdx % BUFFER_SIZE] = frame;
        buf.writeIdx++;
        if (buf.count < BUFFER_SIZE) buf.count++;

        setCurrentFrameIndex(idx);
        setCurrentLap(frame.lap);
        setCurrentT(frame.t);

        state.frame = idx + 1;
        lastTickRef.current = timestamp - (elapsed % frameIntervalMs);
      }
    }

    rafRef.current = requestAnimationFrame(t => tickRef.current(t));
  };

  useEffect(() => {
    if (!race) return;

    // Reset all state for new race
    framesRef.current = null;
    stateRef.current = { frame: 0, speed: 1.0, playing: false };
    currentFrameRef.current = null;
    frameBufferRef.current = { frames: new Array(BUFFER_SIZE).fill(null), writeIdx: 0, count: 0 };

    setCurrentFrameIndex(0);
    setTotalFrames(0);
    setCurrentLap(1);
    setCurrentT(0);
    setIsPlaying(false);
    setIsLoading(true);
    setIsEnded(false);
    setErrorMessage(null);
    setRaceMetadata(null);

    // Stop any existing loop
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    let cancelled = false;
    const base = `${GITHUB_RELEASE_BASE}/${race.tag}/${race.file}`;
    const framesUrl = `${base}_frames.json`;
    const metaUrl   = `${base}_meta.json`;

    const fetchJson = (url: string) =>
      fetch(url).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${url}`);
        return r.json();
      });

    Promise.all([fetchJson(framesUrl), fetchJson(metaUrl)])
      .then(([frames, meta]: [Frame[], RaceMetadata]) => {
        if (cancelled) return;
        framesRef.current = frames;
        setRaceMetadata(meta);
        setTotalFrames(frames.length);
        setIsLoading(false);
        // Start idle rAF loop (plays when sendAction 'play' is called)
        lastTickRef.current = performance.now();
        rafRef.current = requestAnimationFrame(t => tickRef.current(t));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setIsLoading(false);
        setErrorMessage(`Failed to load race data: ${err.message}`);
      });

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race?.tag]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const sendAction = useCallback((action: ClientAction) => {
    const state = stateRef.current;
    const frames = framesRef.current;

    if (action.action === 'play') {
      state.frame = action.from_frame;
      state.speed = action.speed;
      state.playing = true;
      setIsPlaying(true);
      setIsEnded(false);
      lastTickRef.current = performance.now();
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(t => tickRef.current(t));
      }
    } else if (action.action === 'pause') {
      state.playing = false;
      setIsPlaying(false);
    } else if (action.action === 'seek') {
      const idx = Math.max(0, Math.min(action.to_frame, (frames?.length ?? 1) - 1));
      state.frame = idx;
      if (frames && idx < frames.length) {
        const frame = frames[idx];
        currentFrameRef.current = frame;

        const buf = frameBufferRef.current;
        buf.frames[buf.writeIdx % BUFFER_SIZE] = frame;
        buf.writeIdx++;
        if (buf.count < BUFFER_SIZE) buf.count++;

        setCurrentFrameIndex(idx);
        setCurrentLap(frame.lap);
        setCurrentT(frame.t);
      }
      // Restart idle loop if stopped at race end
      if (rafRef.current === null) {
        lastTickRef.current = performance.now();
        rafRef.current = requestAnimationFrame(t => tickRef.current(t));
      }
      setIsEnded(false);
    } else if (action.action === 'set_speed') {
      state.speed = action.speed;
    }
  }, []);

  return {
    currentFrameRef,
    frameBufferRef,
    currentFrameIndex,
    totalFrames,
    currentLap,
    currentT,
    isPlaying,
    isLoading,
    isEnded,
    errorMessage,
    raceMetadata,
    sendAction,
  };
}

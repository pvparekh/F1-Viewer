import { ChangeEvent } from 'react';
import { ClientAction } from '../types';

interface Props {
  currentFrameIndex: number;
  totalFrames: number;
  currentLap: number;
  totalLaps: number;
  currentT: number;
  isPlaying: boolean;
  isLoading: boolean;
  isEnded: boolean;
  speed: number;
  onSpeedChange: (s: number) => void;
  sendAction: (a: ClientAction) => void;
  onShowResults: () => void;
}

const SPEEDS = [0.5, 1, 2, 4] as const;
// 10 seconds of race time at the precomputed 12.5 FPS frame rate
const SKIP_FRAMES = 125;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function IconPlay() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 20, height: 20 }}>
      <path d="M5 3.5l12 6.5-12 6.5V3.5z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 20, height: 20 }}>
      <rect x="4" y="3" width="4" height="14" rx="1.5" />
      <rect x="12" y="3" width="4" height="14" rx="1.5" />
    </svg>
  );
}

function IconSkipBack() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 15, height: 15 }}>
      <rect x="2.5" y="3" width="2.5" height="14" rx="1" />
      <path d="M16.5 4L7.5 10l9 6V4z" />
    </svg>
  );
}

function IconSkipForward() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 15, height: 15 }}>
      <rect x="15" y="3" width="2.5" height="14" rx="1" />
      <path d="M3.5 4l9 6-9 6V4z" />
    </svg>
  );
}

export default function PlaybackBar({
  currentFrameIndex,
  totalFrames,
  currentLap,
  totalLaps,
  currentT,
  isPlaying,
  isLoading,
  isEnded,
  speed,
  onSpeedChange,
  sendAction,
  onShowResults,
}: Props) {
  function handlePlayPause() {
    if (isEnded) {
      sendAction({ action: 'seek', to_frame: 0 });
      sendAction({ action: 'play', from_frame: 0, speed });
      return;
    }
    if (isPlaying) {
      sendAction({ action: 'pause' });
    } else {
      sendAction({ action: 'play', from_frame: currentFrameIndex, speed });
    }
  }

  function handleSkipBack() {
    sendAction({ action: 'seek', to_frame: Math.max(0, currentFrameIndex - SKIP_FRAMES) });
  }

  function handleSkipForward() {
    sendAction({
      action: 'seek',
      to_frame: Math.min(Math.max(0, totalFrames - 1), currentFrameIndex + SKIP_FRAMES),
    });
  }

  function handleScrub(e: ChangeEvent<HTMLInputElement>) {
    sendAction({ action: 'seek', to_frame: Number(e.target.value) });
  }

  function handleSpeedClick(s: number) {
    onSpeedChange(s);
    sendAction({ action: 'set_speed', speed: s });
  }

  const progressPct =
    totalFrames > 1 ? ((currentFrameIndex / (totalFrames - 1)) * 100).toFixed(2) : '0';
  const disabled = isLoading || totalFrames === 0;

  return (
    <div
      className="relative flex flex-col border-t border-[#1a1a1a] flex-shrink-0"
      style={{ background: 'linear-gradient(to top, #0b0b0b 0%, #131313 100%)', height: 88 }}
    >
      {/* ── Progress track ──────────────────────────────────────────── */}
      <div className="relative group" style={{ flexShrink: 0 }}>
        <div
          className="w-full transition-all duration-150 group-hover:h-[5px]"
          style={{
            height: 3,
            background: `linear-gradient(to right, #e10600 ${progressPct}%, rgba(255,255,255,0.07) ${progressPct}%)`,
          }}
        />
        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={currentFrameIndex}
          onChange={handleScrub}
          disabled={totalFrames === 0}
          className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          style={{ height: '100%' }}
          aria-label="Scrub timeline"
        />
      </div>

      {/* ── Controls row ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 flex-1">

        {/* Left: lap counter + elapsed time */}
        <div className="flex items-center gap-3 flex-shrink-0" style={{ minWidth: 130 }}>
          <div>
            {currentLap > 0 && totalLaps > 0 ? (
              <span className="text-sm">
                <span className="text-[10px] uppercase tracking-widest text-[#555555] mr-1">Lap</span>
                <span className="font-semibold text-white tabular-nums">{currentLap}</span>
                <span className="text-[#444444]">/{totalLaps}</span>
              </span>
            ) : (
              <span className="text-[#444444] text-sm">—</span>
            )}
          </div>
          <span className="text-xs font-mono text-[#666666] tabular-nums">
            {currentT > 0 ? formatTime(currentT) : '--:--'}
          </span>
        </div>

        {/* Live badge */}
        {isPlaying && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] uppercase tracking-[0.2em] text-red-500 font-semibold">Live</span>
          </div>
        )}

        <div className="flex-1" />

        {/* ── Center: skip-back · play/pause · skip-forward ── */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={handleSkipBack}
            disabled={disabled}
            title="Back 10 s  (←)"
            className="flex items-center justify-center rounded-full transition-all duration-150 text-[#888888] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.06)' }}
          >
            <IconSkipBack />
          </button>

          {/* Large centered play/pause */}
          <button
            onClick={handlePlayPause}
            disabled={disabled}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="flex items-center justify-center rounded-full transition-all duration-200 flex-shrink-0 text-white disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              width: 44,
              height: 44,
              background: isPlaying ? '#e10600' : 'rgba(255,255,255,0.14)',
              border: `1px solid ${isPlaying ? 'rgba(225,6,0,0.6)' : 'rgba(255,255,255,0.14)'}`,
              boxShadow: isPlaying ? '0 0 18px rgba(225,6,0,0.35)' : 'none',
            }}
          >
            {isLoading ? (
              <svg
                className="animate-spin"
                style={{ width: 18, height: 18 }}
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : isPlaying ? (
              <IconPause />
            ) : (
              <IconPlay />
            )}
          </button>

          <button
            onClick={handleSkipForward}
            disabled={disabled}
            title="Forward 10 s  (→)"
            className="flex items-center justify-center rounded-full transition-all duration-150 text-[#888888] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.06)' }}
          >
            <IconSkipForward />
          </button>
        </div>

        <div className="flex-1" />

        {/* Right: speed pills · results · ? hint */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex gap-1">
            {SPEEDS.map(s => (
              <button
                key={s}
                onClick={() => handleSpeedClick(s)}
                className="rounded transition-all duration-150 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  padding: '4px 8px',
                  background: speed === s ? '#e10600' : 'rgba(255,255,255,0.06)',
                  color: speed === s ? 'white' : '#666666',
                }}
                aria-label={`${s}× speed`}
              >
                {s}×
              </button>
            ))}
          </div>

          <button
            onClick={onShowResults}
            className="rounded text-[10px] uppercase tracking-wider transition-all duration-150 text-gray-500 hover:text-white"
            style={{
              padding: '4px 10px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            Results
          </button>

          <kbd
            className="text-[9px] font-mono rounded text-[#444444]"
            style={{
              padding: '3px 6px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            title="Space=play/pause  ←/→=seek  Shift+←/→=big seek  1-4=speed  F=fullscreen"
          >
            ?
          </kbd>
        </div>
      </div>
    </div>
  );
}

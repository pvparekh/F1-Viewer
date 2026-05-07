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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const frame = Number(e.target.value);
    sendAction({ action: 'seek', to_frame: frame });
  }

  function handleScrubMouseUp(e: React.MouseEvent<HTMLInputElement>) {
    const frame = Number((e.target as HTMLInputElement).value);
    if (!isPlaying) sendAction({ action: 'seek', to_frame: frame });
  }

  function handleSpeedClick(s: number) {
    onSpeedChange(s);
    sendAction({ action: 'set_speed', speed: s });
  }

  const progress = totalFrames > 0 ? currentFrameIndex / (totalFrames - 1) : 0;
  const progressPct = (progress * 100).toFixed(2);

  return (
    <div
      className="relative flex flex-col border-t border-[#1e1e1e]"
      style={{
        background: 'linear-gradient(to top, #0e0e0e 0%, #121212 100%)',
        height: 80,
        flexShrink: 0,
      }}
    >
      {/* Scrub track — sits at top edge of bar */}
      <div className="relative group px-0" style={{ marginTop: -1 }}>
        <div
          className="h-[3px] w-full transition-all duration-150 group-hover:h-[5px]"
          style={{
            background: `linear-gradient(to right, #e10600 ${progressPct}%, rgba(255,255,255,0.08) ${progressPct}%)`,
          }}
        />
        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={currentFrameIndex}
          onChange={handleScrub}
          onMouseUp={handleScrubMouseUp}
          disabled={totalFrames === 0}
          className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          style={{ height: '100%' }}
          aria-label="Scrub timeline"
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-4 px-5 flex-1">
        {/* Play / Pause */}
        <button
          onClick={handlePlayPause}
          disabled={isLoading || totalFrames === 0}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        >
          {isLoading ? (
            <svg className="w-3.5 h-3.5 text-white animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
            </svg>
          ) : isPlaying ? (
            <svg viewBox="0 0 16 16" fill="white" className="w-3.5 h-3.5">
              <rect x="3" y="2" width="3.5" height="12" rx="1" />
              <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" fill="white" className="w-3.5 h-3.5">
              <path d="M4 2.5l10 5.5-10 5.5V2.5z" />
            </svg>
          )}
        </button>

        {/* Lap counter */}
        <div className="flex-shrink-0 text-sm font-medium text-[#888888]" style={{ minWidth: 80 }}>
          {currentLap > 0 && totalLaps > 0 ? (
            <>
              <span className="text-[10px] uppercase tracking-widest text-[#555555] mr-1">Lap</span>
              <span className="text-white font-semibold tabular-nums">{currentLap}</span>
              <span className="text-[#444444]">/{totalLaps}</span>
            </>
          ) : (
            <span className="text-[#444444]">—</span>
          )}
        </div>

        {/* Live indicator + time */}
        <div className="flex items-center gap-2">
          {isPlaying && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] uppercase tracking-[0.2em] text-red-500 font-semibold">Live</span>
            </div>
          )}
          <span className="text-xs font-mono text-[#666666] tabular-nums">
            {currentT > 0 ? formatTime(currentT) : '--:--'}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Speed pills */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => handleSpeedClick(s)}
              className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-150"
              style={
                speed === s
                  ? { background: '#e10600', color: 'white', border: '1px solid #e10600' }
                  : {
                      background: 'transparent',
                      color: '#666666',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }
              }
              onMouseEnter={e => {
                if (speed !== s) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              }}
              onMouseLeave={e => {
                if (speed !== s) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              }}
              aria-label={`${s}× speed`}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Results button */}
        <button
          onClick={onShowResults}
          className="flex-shrink-0 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider transition-all duration-150 text-gray-400"
          style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = ''; }}
          aria-label="View race results"
        >
          Results
        </button>

        {/* Keyboard hint */}
        <div className="flex-shrink-0">
          <kbd
            className="text-[9px] font-mono px-1.5 py-0.5 rounded text-[#444444]"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            title="Keyboard shortcuts"
          >
            ?
          </kbd>
        </div>
      </div>
    </div>
  );
}

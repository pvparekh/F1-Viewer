import { AnimatePresence, motion } from 'framer-motion';
import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { Frame } from '../types';

interface DriverRow {
  code: string;
  pos: number;
  color: string;
  // positive = gained positions since race start (started at higher P number, now lower)
  posChange: number;
}

interface Props {
  currentFrameRef: MutableRefObject<Frame | null>;
  driverColors: Record<string, string>;
  onDriverClick: (code: string) => void;
  selectedDriver: string | null;
  followingDriver: string | null;
}

function formatLapTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export default function TimingTower({
  currentFrameRef,
  driverColors,
  onDriverClick,
  selectedDriver,
  followingDriver,
}: Props) {
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [lap, setLap] = useState(1);
  // Race fastest lap shown in the header (all drivers share the same track, so
  // leader lap times are a good proxy for the overall pace)
  const [fastestLap, setFastestLap] = useState<number | null>(null);
  const [fastestFlash, setFastestFlash] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Per-race tracking refs — reset when driverColors changes (= new race loaded)
  const startingPosRef = useRef<Record<string, number>>({});
  const prevRaceLapRef = useRef<number>(-1);
  const lapStartTRef = useRef<number>(0);
  const bestLapRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset all per-race state
    startingPosRef.current = {};
    prevRaceLapRef.current = -1;
    lapStartTRef.current = 0;
    bestLapRef.current = null;
    setFastestLap(null);
    setFastestFlash(false);

    function sync() {
      const frame = currentFrameRef.current;
      if (!frame) return;

      // Capture starting grid from very first frame
      if (Object.keys(startingPosRef.current).length === 0) {
        for (const [code, d] of Object.entries(frame.drivers)) {
          startingPosRef.current[code] = d.pos;
        }
      }

      // Track race-level lap transitions to compute the race fastest lap.
      // frame.lap is the leader's current lap — one increment = one full lap completed.
      if (prevRaceLapRef.current === -1) {
        prevRaceLapRef.current = frame.lap;
        lapStartTRef.current = frame.t;
      } else if (frame.lap > prevRaceLapRef.current) {
        const elapsed = frame.t - lapStartTRef.current;
        const lapDiff = frame.lap - prevRaceLapRef.current;
        const perLap = lapDiff > 0 ? elapsed / lapDiff : elapsed;
        if (perLap > 40 && perLap < 600) {
          const prev = bestLapRef.current;
          if (prev === null || perLap < prev) {
            bestLapRef.current = perLap;
            setFastestLap(perLap);
            setFastestFlash(true);
            setTimeout(() => setFastestFlash(false), 2500);
          }
        }
        prevRaceLapRef.current = frame.lap;
        lapStartTRef.current = frame.t;
      }

      const sorted = Object.entries(frame.drivers)
        .sort(([, a], [, b]) => a.pos - b.pos)
        .map(([code, d]) => ({
          code,
          pos: d.pos,
          color: driverColors[code] ?? '#888888',
          posChange: (startingPosRef.current[code] ?? d.pos) - d.pos,
        }));

      setRows(sorted);
      setLap(frame.lap);
    }

    intervalRef.current = setInterval(sync, 500);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [currentFrameRef, driverColors]);

  return (
    <div className="h-full flex flex-col bg-[#141414] border-r border-[#1e1e1e] overflow-hidden select-none">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#1e1e1e] flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#666666]">
            The Grid
          </span>
          {lap > 0 && (
            <span className="text-[10px] text-[#444444] tabular-nums">Lap {lap}</span>
          )}
        </div>
        {/* Race fastest lap — appears once data is available */}
        {fastestLap !== null && (
          <div
            className="mt-1 flex items-center gap-1.5 transition-colors duration-300"
            style={{ color: fastestFlash ? '#a855f7' : '#3a3a3a' }}
          >
            <span style={{ fontSize: 8, letterSpacing: '0.15em' }}>FASTEST</span>
            <span className="font-mono tabular-nums" style={{ fontSize: 9 }}>
              {formatLapTime(fastestLap)}
            </span>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-[#444444]">Waiting…</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-0.5">
          <AnimatePresence initial={false}>
            {rows.map(row => {
              const isFollowing = followingDriver === row.code;
              const isSelected = selectedDriver === row.code;
              return (
                <motion.div
                  key={row.code}
                  layout
                  layoutId={row.code}
                  transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                  onClick={() => onDriverClick(row.code)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${row.code} P${row.pos}${isFollowing ? ' — following' : ''}`}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') onDriverClick(row.code);
                  }}
                  className="flex items-center px-2.5 py-1.5 cursor-pointer transition-colors duration-150 relative"
                  style={{
                    gap: 5,
                    background: isFollowing
                      ? 'rgba(225,6,0,0.08)'
                      : isSelected
                        ? 'rgba(255,255,255,0.04)'
                        : undefined,
                    borderLeft: isFollowing ? '2px solid #E10600' : '2px solid transparent',
                  }}
                  whileHover={{
                    backgroundColor: isFollowing
                      ? 'rgba(225,6,0,0.12)'
                      : 'rgba(255,255,255,0.04)',
                  }}
                >
                  {/* Position + change arrow */}
                  <div className="flex items-center flex-shrink-0" style={{ minWidth: 32, gap: 2 }}>
                    <span
                      className="tabular-nums"
                      style={{ fontSize: 11, fontWeight: 500, color: '#555555' }}
                    >
                      {row.pos}
                    </span>
                    {row.posChange > 0 && (
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#22c55e', lineHeight: 1 }}>
                        ↑
                      </span>
                    )}
                    {row.posChange < 0 && (
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#ef4444', lineHeight: 1 }}>
                        ↓
                      </span>
                    )}
                  </div>

                  {/* Team color bar */}
                  <span
                    className="rounded-full flex-shrink-0"
                    style={{ width: 3, height: 16, backgroundColor: row.color }}
                  />

                  {/* Driver code */}
                  <span
                    className="text-sm font-semibold tracking-wide flex-1 truncate"
                    style={{ color: row.color }}
                  >
                    {row.code}
                  </span>

                  {/* Following indicator */}
                  <AnimatePresence>
                    {isFollowing && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        className="flex-shrink-0"
                        style={{ fontSize: 9, color: '#E10600' }}
                        title="Following"
                      >
                        ◉
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

import { AnimatePresence, motion } from 'framer-motion';
import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { Frame } from '../types';

interface DriverRow {
  code: string;
  pos: number;
  color: string;
}

interface Props {
  currentFrameRef: MutableRefObject<Frame | null>;
  driverColors: Record<string, string>;
  onDriverClick: (code: string) => void;
  selectedDriver: string | null;
  followingDriver: string | null;
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function sync() {
      const frame = currentFrameRef.current;
      if (!frame) return;

      const sorted = Object.entries(frame.drivers)
        .sort(([, a], [, b]) => a.pos - b.pos)
        .map(([code, d]) => ({
          code,
          pos: d.pos,
          color: driverColors[code] ?? '#888888',
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
      <div className="px-4 py-3 border-b border-[#1e1e1e]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#666666]">
          The Grid
        </span>
        {lap > 0 && (
          <span className="ml-2 text-[10px] text-[#444444]">Lap {lap}</span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-[#444444]">Waiting…</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-1">
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
                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors duration-150 relative"
                  style={{
                    background: isFollowing
                      ? 'rgba(225,6,0,0.08)'
                      : isSelected
                        ? 'rgba(255,255,255,0.04)'
                        : undefined,
                    borderLeft: isFollowing ? '2px solid #E10600' : '2px solid transparent',
                  }}
                  whileHover={{ backgroundColor: isFollowing ? 'rgba(225,6,0,0.12)' : 'rgba(255,255,255,0.04)' }}
                >
                  <span className="w-5 text-right text-[10px] font-medium text-[#555555]">
                    {row.pos}
                  </span>
                  <span
                    className="w-1 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: row.color }}
                  />
                  <span
                    className="text-sm font-semibold tracking-wide flex-1"
                    style={{ color: row.color }}
                  >
                    {row.code}
                  </span>
                  {isFollowing && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      className="text-red-500 text-[9px] flex-shrink-0"
                      title="Following"
                    >
                      ◉
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

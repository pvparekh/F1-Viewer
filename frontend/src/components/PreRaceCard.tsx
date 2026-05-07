import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface Props {
  raceName: string;
  year: number;
  circuitLocation: string;
  totalLaps: number;
  isReady: boolean;
  onStart: () => void;
}

const LOAD_DURATION_MS = 17_000;
const TICK_MS = 100;

export default function PreRaceCard({
  raceName,
  year,
  circuitLocation,
  totalLaps,
  isReady,
  onStart,
}: Props) {
  const [ticks, setTicks] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (isReady) {
      setTicks(LOAD_DURATION_MS / TICK_MS);
      return;
    }

    setTicks(0);
    intervalRef.current = setInterval(() => {
      setTicks((t) => Math.min(t + 1, LOAD_DURATION_MS / TICK_MS));
    }, TICK_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isReady, raceName]);

  const maxTicks = LOAD_DURATION_MS / TICK_MS;
  const pct = isReady ? 100 : Math.min(Math.round((ticks / maxTicks) * 100), 99);

  return (
    <motion.div
      key="prerace-card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'rgba(7,7,7,0.97)', backdropFilter: 'blur(12px)' }}
    >
      {/* Decorative background year — very faint, large */}
      <div
        className="pointer-events-none select-none absolute font-black text-white"
        style={{
          fontSize: 'clamp(200px, 30vw, 380px)',
          lineHeight: 1,
          letterSpacing: '-0.06em',
          opacity: 0.025,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        {year}
      </div>

      {/* Radial red glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 60%, rgba(225,6,0,0.09) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center px-8 max-w-2xl">
        {/* Eyebrow */}
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05, duration: 0.4 }}
          className="text-[10px] font-semibold uppercase text-red-500"
          style={{ letterSpacing: '0.35em' }}
        >
          Formula 1 · {year} Season
        </motion.p>

        {/* Race title */}
        <motion.h1
          initial={{ y: 28, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="font-black text-white leading-none tracking-tight"
          style={{ fontSize: 'clamp(40px, 6vw, 72px)', letterSpacing: '-0.03em' }}
        >
          {raceName}
        </motion.h1>

        {/* Meta row */}
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex items-center gap-3 text-sm text-gray-500"
        >
          <span>{circuitLocation}</span>
          <span className="w-1 h-1 rounded-full bg-gray-700" />
          <span>{totalLaps > 0 ? `${totalLaps} Laps` : '…'}</span>
        </motion.div>

        {/* Divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.28, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-16 h-px bg-[#333333]"
        />

        {/* CTA */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.34, duration: 0.4 }}
          className="flex flex-col items-center gap-3"
        >
          {isReady ? (
            <>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={onStart}
                className="rounded font-bold uppercase tracking-widest bg-[#E10600] text-white hover:bg-[#c80500] cursor-pointer transition-colors duration-200"
                style={{ fontSize: 15, height: 52, width: 200, letterSpacing: '0.15em' }}
              >
                WATCH RACE
              </motion.button>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-[10px] uppercase tracking-widest text-gray-700"
              >
                or press <kbd
                  className="px-1.5 py-0.5 rounded text-gray-600"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >Space</kbd>
              </motion.p>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center gap-3"
              style={{ width: 260 }}
            >
              {/* Spinner + label */}
              <div className="flex items-center gap-2.5">
                <svg
                  className="animate-spin"
                  style={{ width: 14, height: 14, color: '#E10600' }}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span
                  className="uppercase text-gray-500"
                  style={{ fontSize: 10, letterSpacing: '0.25em' }}
                >
                  Loading race data…
                </span>
                <span style={{ fontSize: 10, color: '#E10600', fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'right' }}>
                  {pct}%
                </span>
              </div>

              {/* Progress bar */}
              <div
                className="rounded-full overflow-hidden"
                style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.06)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg, #7a0300 0%, #E10600 100%)',
                    transition: 'width 0.1s linear',
                  }}
                />
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

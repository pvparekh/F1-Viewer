import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

const CONTROLS = [
  { key: 'Click driver', desc: 'Follow camera + open stats' },
  { key: 'Space', desc: 'Play / Pause' },
  { key: '← →', desc: 'Seek ±100 frames' },
  { key: 'Shift ← →', desc: 'Seek ±500 frames' },
  { key: '1 – 4', desc: '0.5× · 1× · 2× · 4× speed' },
  { key: 'F', desc: 'Toggle fullscreen' },
  { key: '?', desc: 'All shortcuts' },
];

interface Props {
  visible: boolean;
}

export default function TrackHint({ visible }: Props) {
  const [dismissed, setDismissed] = useState(false);

  return (
    <AnimatePresence>
      {visible && !dismissed && (
        <motion.div
          className="absolute right-3 z-20 pointer-events-auto"
          style={{ top: '50%', transform: 'translateY(-50%)', width: 210 }}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.3, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: 'rgba(12, 12, 12, 0.88)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              <span className="text-[9px] uppercase tracking-[0.25em] text-gray-500">
                Quick Guide
              </span>
              <button
                onClick={() => setDismissed(true)}
                className="text-gray-700 hover:text-gray-400 transition-colors text-base leading-none"
                aria-label="Dismiss guide"
              >
                ×
              </button>
            </div>

            {/* Camera follow highlight */}
            <div
              className="px-4 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(225,6,0,0.06)' }}
            >
              <div className="flex items-start gap-2.5">
                <div className="w-1 h-full min-h-[32px] rounded-full bg-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-[11px] font-semibold leading-tight">
                    Click any driver
                  </p>
                  <p className="text-gray-500 text-[10px] mt-0.5 leading-tight">
                    Follows camera + opens lap stats
                  </p>
                </div>
              </div>
            </div>

            {/* Controls list */}
            <div className="px-4 py-2.5 flex flex-col gap-1.5">
              {CONTROLS.slice(1).map(({ key, desc }) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <kbd
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded text-gray-300 flex-shrink-0"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {key}
                  </kbd>
                  <span className="text-[10px] text-gray-500 text-right leading-tight">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { AnimatePresence, motion } from 'framer-motion';

const SHORTCUTS = [
  { key: 'Space', label: 'Play / Pause (or start race)' },
  { key: '← →', label: 'Seek ±100 frames' },
  { key: 'Shift ← →', label: 'Seek ±500 frames' },
  { key: '1 – 4', label: '0.5× · 1× · 2× · 4× speed' },
  { key: 'F', label: 'Toggle fullscreen' },
  { key: 'Esc', label: 'Exit camera follow' },
  { key: '?', label: 'Toggle this panel' },
];

interface Props {
  show: boolean;
  onClose: () => void;
}

export default function KeyboardHints({ show, onClose }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed bottom-24 right-6 z-50 rounded-xl overflow-hidden"
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          style={{
            background: 'rgba(18, 18, 18, 0.94)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            minWidth: 270,
          }}
        >
          <div className="px-5 py-3.5 border-b border-[#222222] flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.25em] text-gray-500">
              Keyboard Shortcuts
            </span>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-white transition-colors leading-none text-xl"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="px-5 py-3 flex flex-col gap-2.5">
            {SHORTCUTS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-5">
                <kbd
                  className="text-[10px] font-mono px-2 py-0.5 rounded whitespace-nowrap text-gray-200"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {key}
                </kbd>
                <span className="text-xs text-gray-500 text-right">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

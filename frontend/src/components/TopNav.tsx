import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Session } from '../types';

interface Props {
  mode: 'landing' | 'viewer';
  currentRace?: { year: number; round: number; name: string };
  sessions?: Session[];
  onBackToLanding?: () => void;
  onSelectRace?: (year: number, round: number, name: string) => void;
}

function IconArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M8.5 2.5L4 7l4.5 4.5" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-1.5 select-none" aria-label="FormulaVision">
      <span
        className="font-black leading-none"
        style={{ fontSize: 15, letterSpacing: '-0.03em' }}
      >
        <span style={{ color: '#E10600' }}>Formula</span>
        <span className="text-white">Vision</span>
      </span>
      <div className="w-[5px] h-[5px] rounded-full bg-[#E10600] flex-shrink-0" />
    </div>
  );
}

export default function TopNav({
  mode,
  currentRace,
  sessions = [],
  onBackToLanding,
  onSelectRace,
}: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header
      className="flex-shrink-0 flex items-center justify-between w-full h-14 px-6 z-50"
      style={{
        background: 'rgba(10,10,10,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      {/* LEFT — logo always visible; back button added in viewer mode */}
      <div className="flex items-center gap-3">
        <div
          className="opacity-90 hover:opacity-100 transition-opacity duration-200 cursor-default"
          onClick={mode === 'viewer' ? onBackToLanding : undefined}
          style={{ cursor: mode === 'viewer' ? 'pointer' : 'default' }}
        >
          <Logo />
        </div>

        {mode === 'viewer' && (
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-all duration-200"
            aria-label="Back to race selection"
          >
            <IconArrowLeft />
            <span className="text-[10px] uppercase tracking-widest font-medium">Races</span>
          </button>
        )}
      </div>

      {/* CENTER */}
      {mode === 'viewer' && currentRace ? (
        <div className="flex items-center gap-2 text-sm select-none">
          <span className="text-gray-600 tabular-nums text-xs">{currentRace.year}</span>
          <span className="text-gray-700">·</span>
          <span className="text-gray-300 font-medium text-sm">{currentRace.name}</span>
        </div>
      ) : (
        <div />
      )}

      {/* RIGHT */}
      {mode === 'landing' ? (
        <div className="flex items-center gap-8">
          <a
            href="https://github.com/theOehrly/Fast-F1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] uppercase tracking-widest text-gray-600 hover:text-white transition-colors duration-200"
          >
            Sources
          </a>
          <a
            href="#"
            className="text-[10px] uppercase tracking-widest text-gray-600 hover:text-white transition-colors duration-200"
          >
            About
          </a>
        </div>
      ) : (
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider text-gray-400 transition-all duration-200 hover:bg-white/10"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Switch Race
            <motion.span
              animate={{ rotate: dropdownOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex' }}
            >
              <IconChevronDown />
            </motion.span>
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-10 w-72 rounded-xl overflow-hidden"
                style={{
                  background: 'rgba(14,14,14,0.97)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 24px 48px rgba(0,0,0,0.7)',
                  padding: 8,
                }}
              >
                {sessions.map(s => {
                  const isActive =
                    currentRace?.year === s.year && currentRace?.round === s.round;
                  return (
                    <button
                      key={`${s.year}_${s.round}`}
                      onClick={() => {
                        onSelectRace?.(s.year, s.round, s.name);
                        setDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-white/5"
                      style={
                        isActive
                          ? {
                              background: 'rgba(225,6,0,0.1)',
                              borderLeft: '2px solid #E10600',
                              paddingLeft: 10,
                            }
                          : undefined
                      }
                    >
                      <span className="font-mono text-xs text-gray-500">{s.year}</span>
                      <span className="text-sm text-white">{s.name}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </header>
  );
}

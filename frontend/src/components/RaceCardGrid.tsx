import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Session } from '../types';

// ---------------------------------------------------------------------------
// Card theme
// ---------------------------------------------------------------------------

interface CardTheme {
  color: string;
  location: string;
  code: string;
}

function getCardTheme(name: string): CardTheme {
  const n = name.toLowerCase();
  if (n.includes('monaco'))
    return { color: '#E10600', location: 'Monte Carlo, Monaco', code: 'MONACO · MC' };
  if (n.includes('british') || n.includes('silverstone'))
    return { color: '#00A650', location: 'Silverstone, United Kingdom', code: 'SILVERSTONE · GB' };
  if (n.includes('italian') || n.includes('monza'))
    return { color: '#009246', location: 'Monza, Italy', code: 'MONZA · IT' };
  if (n.includes('bahrain'))
    return { color: '#C9A961', location: 'Sakhir, Bahrain', code: 'BAHRAIN · BH' };
  if (n.includes('singapore'))
    return { color: '#E8002D', location: 'Marina Bay, Singapore', code: 'SINGAPORE · SG' };
  return { color: '#555555', location: '', code: '' };
}

// ---------------------------------------------------------------------------
// Stat card (hero section)
// ---------------------------------------------------------------------------

function StatCard({ value, label }: { value: string; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        minWidth: 160,
        transform: hovered ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 300ms',
        borderRadius: 12,
        padding: '24px 32px',
        cursor: 'default',
      }}
    >
      <div className="text-4xl font-black text-white leading-none">{value}</div>
      <div className="text-xs uppercase tracking-widest text-gray-500 mt-2">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Race card
// ---------------------------------------------------------------------------

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface CardProps {
  session: Session;
  index: number;
  onSelectRace: (year: number, round: number, name: string) => void;
}

function RaceCard({ session, index, onSelectRace }: CardProps) {
  const [hovered, setHovered] = useState(false);
  const theme = getCardTheme(session.name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -6, scale: 1.01, transition: { type: 'tween', duration: 0.3, ease: [0.4, 0, 0.2, 1] } }}
      whileTap={{ scale: 0.985 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => onSelectRace(session.year, session.round, session.name)}
      role="button"
      tabIndex={0}
      aria-label={`Watch ${session.name} ${session.year}`}
      onKeyDown={e => e.key === 'Enter' && onSelectRace(session.year, session.round, session.name)}
      className="relative w-full cursor-pointer overflow-hidden rounded-xl"
      style={{
        aspectRatio: '16/9',
        background: hovered
          ? 'linear-gradient(135deg, #161616 0%, #0e0e0e 100%)'
          : 'linear-gradient(135deg, #111111 0%, #0a0a0a 100%)',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: hovered
          ? '0 24px 48px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)'
          : 'none',
        padding: 28,
        transition: 'background 400ms, border-color 400ms, box-shadow 400ms',
      }}
    >
      {/* Circuit-color left border accent */}
      <motion.div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: theme.color, transformOrigin: 'top' }}
        animate={{ scaleY: hovered ? 1 : 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      />

      {/* Inner hover glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(225,6,0,0.08), transparent 70%)',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 400ms',
        }}
      />

      {/* Shimmer sweep */}
      {hovered && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl"
          initial={{ x: '-100%' }}
          animate={{ x: '120%' }}
          transition={{ duration: 1.2, ease: 'linear' }}
          style={{
            background:
              'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.05) 50%, transparent 60%)',
          }}
        />
      )}

      {/* Faint decorative year */}
      <div
        className="pointer-events-none absolute top-5 right-6 select-none font-black leading-none tracking-tight"
        style={{
          fontSize: 52,
          color: `rgba(255,255,255,${hovered ? 0.3 : 0.15})`,
          letterSpacing: '-0.04em',
          transition: 'color 400ms',
        }}
      >
        {session.year}
      </div>

      {/* Card content */}
      <div className="relative z-10 flex h-full flex-col justify-end">
        <p
          className="text-xs uppercase tracking-widest text-gray-500"
          style={{ letterSpacing: '0.25em' }}
        >
          {theme.code}
        </p>
        <h3 className="mt-1 text-2xl font-bold text-white leading-tight">
          {session.name}
        </h3>
        <p className="mt-1 text-sm text-gray-400">{theme.location}</p>

        {/* Bottom row */}
        <div className="mt-5 flex items-center justify-between">
          <span className="font-mono text-xs text-gray-600 uppercase tracking-wider">
            {session.year} Season
          </span>
          <motion.span
            className="text-gray-500"
            animate={{ x: hovered ? 4 : 0 }}
            transition={{ type: 'tween', duration: 0.25 }}
          >
            <IconArrow />
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Scroll indicator
// ---------------------------------------------------------------------------

function ScrollIndicator() {
  return (
    <div className="mt-16 flex flex-col items-center gap-2">
      <span
        className="text-xs uppercase text-gray-600"
        style={{ letterSpacing: '0.3em' }}
      >
        Select a Race
      </span>
      <motion.div
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="text-gray-700"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  sessions: Session[];
  onSelectRace: (year: number, round: number, name: string) => void;
}

const FILTER_YEARS = ['ALL', 2023, 2024] as const;
type FilterYear = typeof FILTER_YEARS[number];

export default function RaceCardGrid({ sessions, onSelectRace }: Props) {
  const [filterYear, setFilterYear] = useState<FilterYear>('ALL');

  if (sessions.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="animate-pulse text-sm text-[#555555]">Loading races…</span>
      </div>
    );
  }

  const filteredSessions =
    filterYear === 'ALL' ? sessions : sessions.filter(s => s.year === filterYear);

  return (
    <div className="w-full">
      {/* ── Cinematic Hero ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 30% 20%, rgba(225,6,0,0.08) 0%, transparent 50%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 80% 80%, rgba(225,6,0,0.04) 0%, transparent 60%)',
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-8 pt-20 pb-20">
          {/* Eyebrow */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-xs font-medium text-red-500 uppercase mb-6"
            style={{ letterSpacing: '0.3em' }}
          >
            Formula 1 · Telemetry Replay
          </motion.p>

          {/* Title: FormulaVision */}
          <div className="leading-none mb-6">
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
              className="font-black leading-none tracking-tight"
              style={{ fontSize: 'clamp(52px, 8vw, 96px)', letterSpacing: '-0.04em' }}
            >
              <span style={{ color: '#E10600' }}>Formula</span>
              <span className="text-white">Vision</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-xl text-gray-500 mt-4 max-w-xl leading-relaxed"
            >
              Frame-perfect telemetry replay with live timing and camera follow.
            </motion.p>
          </div>

          {/* Stats cards */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="flex flex-wrap gap-4 mt-10"
          >
            <StatCard value="5" label="Races Available" />
            <StatCard value="2" label="Seasons · 2023-2024" />
            <StatCard value="60FPS" label="Interpolated Playback" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <ScrollIndicator />
          </motion.div>
        </div>
      </div>

      {/* ── Browse section header ──────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-8 pt-16 pb-10 flex items-baseline justify-between">
        <div>
          <p
            className="text-xs font-medium text-red-500 uppercase"
            style={{ letterSpacing: '0.3em' }}
          >
            Browse
          </p>
          <h2 className="mt-2 text-3xl font-bold text-white">Featured Races</h2>
        </div>

        {/* Year filter pills — functional */}
        <div className="flex items-center gap-2">
          {FILTER_YEARS.map(year => {
            const active = filterYear === year;
            return (
              <button
                key={String(year)}
                onClick={() => setFilterYear(year)}
                className="px-4 py-1.5 rounded-full text-xs uppercase tracking-wider transition-all duration-200"
                style={
                  active
                    ? { background: 'white', color: 'black' }
                    : {
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#9ca3af',
                        background: 'transparent',
                      }
                }
                onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              >
                {String(year)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Cards grid ────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-8 pb-20 grid grid-cols-1 gap-5 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
        {filteredSessions.map((session, index) => (
          <RaceCard
            key={`${session.year}_${session.round}`}
            session={session}
            index={index}
            onSelectRace={onSelectRace}
          />
        ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

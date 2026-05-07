import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { RaceResultRow } from '../types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

const MEDAL_COLORS = ['#C9A961', '#C0C0C0', '#CD7F32'] as const;
const PODIUM_HEIGHTS = [140, 100, 80] as const; // P1, P2, P3 bar heights

interface Props {
  year: number;
  round: number;
  raceName: string;
  driverColors: Record<string, string>;
  onClose: () => void;
}

function PodiumPillar({
  result,
  rank,
  driverColor,
}: {
  result: RaceResultRow;
  rank: 0 | 1 | 2; // index in podium order [P1, P2, P3]
  driverColor: string;
}) {
  const displayOrder = [1, 0, 2]; // visual: P2, P1, P3
  const height = PODIUM_HEIGHTS[rank];
  const label = rank + 1;

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + displayOrder[rank] * 0.08, duration: 0.45 }}
    >
      {/* Driver info above pillar */}
      <div className="text-center mb-3">
        <div
          className="w-2 h-2 rounded-full mx-auto mb-2"
          style={{ background: driverColor }}
        />
        <div className="text-white font-bold text-sm tabular-nums tracking-wide">
          {result.abbreviation}
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5 max-w-[90px] truncate">
          {result.team}
        </div>
        {result.time && (
          <div className="text-[10px] font-mono text-gray-400 mt-1">{result.time}</div>
        )}
        {!result.time && result.status !== 'Finished' && (
          <div className="text-[10px] text-gray-600 mt-1">{result.status}</div>
        )}
      </div>

      {/* Pillar */}
      <motion.div
        className="w-20 flex items-center justify-center rounded-t-sm"
        style={{
          height,
          background: `rgba(${hexToRgb(driverColor)}, 0.15)`,
          border: `1px solid rgba(${hexToRgb(driverColor)}, 0.3)`,
          transformOrigin: 'bottom',
        }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.3 + displayOrder[rank] * 0.08, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <span
          className="text-2xl font-black"
          style={{ color: MEDAL_COLORS[rank] }}
        >
          P{label}
        </span>
      </motion.div>
    </motion.div>
  );
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '255,255,255';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

function PositionBadge({ pos }: { pos: number | null }) {
  if (pos === null) return <span className="text-gray-600 tabular-nums font-mono text-xs">DNF</span>;
  const colors =
    pos === 1 ? 'text-yellow-400' :
    pos === 2 ? 'text-gray-300' :
    pos === 3 ? 'text-orange-400' :
    pos <= 10 ? 'text-white' : 'text-gray-500';
  return (
    <span className={`tabular-nums font-bold text-sm ${colors}`}>
      {pos}
    </span>
  );
}

export default function RaceResults({ year, round, raceName, driverColors, onClose }: Props) {
  const [results, setResults] = useState<RaceResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/sessions/${year}/${round}/results`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        setResults(d.results ?? []);
        setLoading(false);
      })
      .catch(e => {
        setError(String(e));
        setLoading(false);
      });
  }, [year, round]);

  const podium = results.filter(r => r.position !== null && r.position <= 3)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(5,5,5,0.97)', backdropFilter: 'blur(24px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-8 py-5 border-b border-[#1a1a1a] flex-shrink-0"
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-red-500 mb-1">Race Result</p>
          <h2 className="text-2xl font-bold text-white">{raceName}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{year} Formula 1 Season</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close results"
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-colors text-xl"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <span className="text-xs uppercase tracking-widest text-gray-600 animate-pulse">
              Loading results…
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-40">
            <span className="text-xs text-red-600">{error}</span>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Podium */}
            {podium.length >= 3 && (
              <div className="max-w-3xl mx-auto px-8 pt-10 pb-8">
                <div className="flex items-end justify-center gap-3">
                  {/* P2, P1, P3 visual order */}
                  {[podium[1], podium[0], podium[2]].map((r, i) => {
                    if (!r) return null;
                    const rankMap = [1, 0, 2] as const; // visual index → podium rank
                    return (
                      <PodiumPillar
                        key={r.abbreviation}
                        result={r}
                        rank={rankMap[i]}
                        driverColor={driverColors[r.abbreviation] ?? '#888888'}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full results table */}
            <div className="max-w-3xl mx-auto px-8 pb-16">
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {/* Table header */}
                <div
                  className="grid text-[9px] uppercase tracking-[0.2em] text-gray-600 px-5 py-2.5"
                  style={{
                    gridTemplateColumns: '40px 1fr 140px 100px 50px',
                    background: 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span>Pos</span>
                  <span>Driver</span>
                  <span>Team</span>
                  <span>Time / Gap</span>
                  <span className="text-right">Pts</span>
                </div>

                {/* Rows */}
                {results.map((r, i) => (
                  <motion.div
                    key={r.abbreviation}
                    className="grid items-center px-5 py-3"
                    style={{
                      gridTemplateColumns: '40px 1fr 140px 100px 50px',
                      borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.3 }}
                  >
                    <PositionBadge pos={r.position} />

                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-0.5 h-5 rounded-full flex-shrink-0"
                        style={{ background: driverColors[r.abbreviation] ?? '#555555' }}
                      />
                      <div className="min-w-0">
                        <div className="text-white text-sm font-semibold truncate">
                          {r.full_name}
                        </div>
                        <div className="text-gray-600 text-[10px] font-mono">{r.abbreviation}</div>
                      </div>
                    </div>

                    <span className="text-gray-500 text-xs truncate">{r.team}</span>

                    <span className="text-gray-400 text-xs font-mono">
                      {r.time ?? (r.status !== 'Finished' ? r.status : '—')}
                    </span>

                    <span className="text-right text-xs font-semibold text-gray-300 tabular-nums">
                      {r.points > 0 ? r.points : '—'}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

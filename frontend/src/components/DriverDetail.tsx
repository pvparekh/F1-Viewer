import { AnimatePresence, motion } from 'framer-motion';
import { MutableRefObject, useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BUFFER_SIZE, Frame, FrameBuffer } from '../types';

const DRIVER_NAMES: Record<string, string> = {
  VER: 'Max Verstappen', PER: 'Sergio Pérez', HAM: 'Lewis Hamilton',
  RUS: 'George Russell', LEC: 'Charles Leclerc', SAI: 'Carlos Sainz',
  NOR: 'Lando Norris', PIA: 'Oscar Piastri', ALO: 'Fernando Alonso',
  STR: 'Lance Stroll', GAS: 'Pierre Gasly', OCO: 'Esteban Ocon',
  ALB: 'Alexander Albon', SAR: 'Logan Sargeant', BOT: 'Valtteri Bottas',
  ZHO: 'Guanyu Zhou', TSU: 'Yuki Tsunoda', RIC: 'Daniel Ricciardo',
  MAG: 'Kevin Magnussen', HUL: 'Nico Hülkenberg', DEV: 'Nyck de Vries',
  LAW: 'Liam Lawson', ANT: 'Kimi Antonelli', BEA: 'Oliver Bearman',
  DOO: 'Jack Doohan', HAD: 'Isack Hadjar', COL: 'Franco Colapinto',
};

function formatLapTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

interface Props {
  driverCode: string | null;
  driverColor: string;
  frameBufferRef: MutableRefObject<FrameBuffer>;
  currentLap: number;
  onClose: () => void;
}

function getOrderedFrames(buf: FrameBuffer): Frame[] {
  const count = Math.min(buf.count, BUFFER_SIZE);
  if (count === 0) return [];
  const start = buf.count <= BUFFER_SIZE ? 0 : buf.writeIdx % BUFFER_SIZE;
  const frames: Frame[] = [];
  for (let i = 0; i < count; i++) {
    const f = buf.frames[(start + i) % BUFFER_SIZE];
    if (f !== null) frames.push(f);
  }
  return frames;
}

function computeChartData(code: string, buf: FrameBuffer) {
  const frames = getOrderedFrames(buf);
  const driverFrames = frames.filter(f => code in f.drivers);
  if (driverFrames.length === 0) return null;

  const timeSeries = driverFrames
    .filter((_, i) => i % 20 === 0)
    .map(f => ({ min: Math.floor(f.t / 60), pos: f.drivers[code].pos }));

  const lapMap: Record<number, { pos: number; behind: number; t: number }> = {};
  for (const f of driverFrames) {
    lapMap[f.lap] = {
      pos: f.drivers[code].pos,
      behind: Math.max(0, f.drivers[code].pos - 1),
      t: f.t,
    };
  }
  const lapSeries = Object.entries(lapMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([lap, v]) => ({ lap: Number(lap), pos: v.pos, behind: v.behind, t: v.t }));

  const rawLapTimes = lapSeries.slice(1).map((curr, i) => curr.t - lapSeries[i].t);
  const validLapTimes = rawLapTimes.filter(t => t > 40 && t < 250);
  const fastestLap = validLapTimes.length > 0 ? Math.min(...validLapTimes) : null;

  const positions = driverFrames.map(f => f.drivers[code].pos);
  const bestPos = Math.min(...positions);
  const lapsLedFrames = positions.filter(p => p === 1).length;
  const lapsLed = driverFrames.length > 0
    ? Math.round((lapsLedFrames / driverFrames.length) *
        (driverFrames[driverFrames.length - 1].lap - driverFrames[0].lap + 1))
    : 0;
  const currentPos = positions[positions.length - 1] ?? '—';

  return { timeSeries, lapSeries, bestPos, lapsLed, currentPos, fastestLap };
}

const chartCommon = { margin: { top: 4, right: 8, bottom: 4, left: -16 } };
const axisStyle = { fontSize: 10, fill: '#555555' };
const gridStyle = { stroke: '#1e1e1e' };

interface StatCardProps { label: string; value: string | number }
function StatCard({ label, value }: StatCardProps) {
  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-1"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <span className="text-[10px] uppercase tracking-widest text-gray-600">{label}</span>
      <span className="text-xl font-bold text-white">{value}</span>
    </div>
  );
}

export default function DriverDetail({
  driverCode,
  driverColor,
  frameBufferRef,
  currentLap,
  onClose,
}: Props) {
  const data = useMemo(() => {
    if (!driverCode) return null;
    return computeChartData(driverCode, frameBufferRef.current);
  }, [driverCode, currentLap, frameBufferRef]);

  return (
    <AnimatePresence>
      {driverCode && (
        <>
          {/* Backdrop */}
          <motion.div
            key="driver-backdrop"
            className="absolute inset-0 z-20"
            style={{ background: 'rgba(0,0,0,0.25)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="driver-detail"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="absolute inset-y-0 right-0 z-30 flex flex-col overflow-hidden"
            style={{
              width: 360,
              background: '#0d0d0d',
              borderLeft: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: driverColor }} />
                <div className="flex flex-col leading-tight">
                  <span className="font-bold text-white" style={{ fontSize: 22, lineHeight: 1.2 }}>
                    {DRIVER_NAMES[driverCode] ?? driverCode}
                  </span>
                  <span className="text-gray-600 text-xs mt-0.5">
                    {driverCode}{data ? ` · P${data.currentPos}` : ''}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-7 h-7 flex items-center justify-center rounded text-gray-600 hover:text-white hover:bg-white/8 transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {!data ? (
                <p className="text-xs text-gray-600 text-center pt-8">
                  No data in buffer yet — start playback first.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard label="Best Position" value={`P${data.bestPos}`} />
                    <StatCard label="Laps Led" value={data.lapsLed} />
                    <StatCard label="Current" value={`P${data.currentPos}`} />
                    <StatCard
                      label="Fastest Lap"
                      value={data.fastestLap !== null ? formatLapTime(data.fastestLap) : '—'}
                    />
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 mb-2">
                      Position over race time
                    </p>
                    <ResponsiveContainer width="100%" height={90}>
                      <LineChart data={data.timeSeries} {...chartCommon}>
                        <CartesianGrid {...gridStyle} />
                        <XAxis dataKey="min" tick={axisStyle} tickLine={false} axisLine={false} unit="m" />
                        <YAxis tick={axisStyle} tickLine={false} axisLine={false} reversed domain={[1, 'dataMax']} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ background: '#1a1a1a', border: '1px solid #242424', borderRadius: 6, fontSize: 11 }}
                          labelStyle={{ color: '#888888' }}
                          formatter={(v: number) => [`P${v}`, 'Position']}
                          labelFormatter={(l: number) => `${l} min`}
                        />
                        <Line dataKey="pos" stroke={driverColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 mb-2">
                      Position by lap
                    </p>
                    <ResponsiveContainer width="100%" height={90}>
                      <LineChart data={data.lapSeries} {...chartCommon}>
                        <CartesianGrid {...gridStyle} />
                        <XAxis dataKey="lap" tick={axisStyle} tickLine={false} axisLine={false} />
                        <YAxis tick={axisStyle} tickLine={false} axisLine={false} reversed domain={[1, 'dataMax']} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ background: '#1a1a1a', border: '1px solid #242424', borderRadius: 6, fontSize: 11 }}
                          labelStyle={{ color: '#888888' }}
                          formatter={(v: number) => [`P${v}`, 'Position']}
                          labelFormatter={(l: number) => `Lap ${l}`}
                        />
                        <Line dataKey="pos" stroke={driverColor} strokeWidth={2} dot={{ r: 2, fill: driverColor }} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 mb-2">
                      Positions behind leader
                    </p>
                    <ResponsiveContainer width="100%" height={90}>
                      <LineChart data={data.lapSeries} {...chartCommon}>
                        <CartesianGrid {...gridStyle} />
                        <XAxis dataKey="lap" tick={axisStyle} tickLine={false} axisLine={false} />
                        <YAxis tick={axisStyle} tickLine={false} axisLine={false} domain={[0, 'dataMax']} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ background: '#1a1a1a', border: '1px solid #242424', borderRadius: 6, fontSize: 11 }}
                          labelStyle={{ color: '#888888' }}
                          formatter={(v: number) => [v === 0 ? 'Leader' : `+${v} pos`, 'Gap']}
                          labelFormatter={(l: number) => `Lap ${l}`}
                        />
                        <Line dataKey="behind" stroke="#555555" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

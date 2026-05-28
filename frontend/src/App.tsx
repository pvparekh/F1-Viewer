import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import DriverDetail from './components/DriverDetail';
import KeyboardHints from './components/KeyboardHints';
import PlaybackBar from './components/PlaybackBar';
import PreRaceCard from './components/PreRaceCard';
import RaceCardGrid from './components/RaceCardGrid';
import RaceResults from './components/RaceResults';
import TimingTower from './components/TimingTower';
import TopBar from './components/TopBar';
import TrackHint from './components/TrackHint';
import TopNav from './components/TopNav';
import TrackMap from './components/TrackMap';
import { useRaceWebSocket } from './hooks/useRaceWebSocket';
import { RaceMetadata, Session, TrackPoint } from './types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

const CIRCUIT_LOCATIONS: Record<string, string> = {
  'Monaco Grand Prix': 'Monte Carlo, Monaco',
  'British Grand Prix': 'Silverstone, England',
  'Italian Grand Prix': 'Monza, Italy',
  'Bahrain Grand Prix': 'Sakhir, Bahrain',
  'Singapore Grand Prix': 'Marina Bay, Singapore',
};

const EMPTY_COLORS: Record<string, string> = {};
const EMPTY_TRACK: TrackPoint[] = [];

export default function App() {
  const [viewMode, setViewMode] = useState<'landing' | 'viewer'>('landing');
  const [selectedRace, setSelectedRace] = useState<Session | null>(null);
  const [metadata, setMetadata] = useState<RaceMetadata | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [showPreRace, setShowPreRace] = useState(false);
  const [raceStarted, setRaceStarted] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [followingDriver, setFollowingDriver] = useState<string | null>(null);

  const {
    currentFrameRef,
    frameBufferRef,
    currentFrameIndex,
    totalFrames,
    currentLap,
    currentT,
    isPlaying,
    isLoading,
    isEnded,
    errorMessage,
    sendAction,
  } = useRaceWebSocket(selectedRace?.year ?? null, selectedRace?.round ?? null);

  useEffect(() => {
    fetch(`${API_URL}/api/sessions`)
      .then(r => r.json())
      .then((data: Session[]) => setSessions(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedRace) return;
    setMetadata(null);
    setMetaLoading(true);
    fetch(`${API_URL}/api/sessions/${selectedRace.year}/${selectedRace.round}/metadata`)
      .then(r => r.json())
      .then((d: RaceMetadata) => {
        setMetadata(d);
        setMetaLoading(false);
      })
      .catch(() => setMetaLoading(false));
  }, [selectedRace]);

  const isReady = !isLoading && totalFrames > 0 && metadata !== null;

  // Refs so the keyboard handler never captures stale values
  const kbRef = useRef({
    isPlaying: false,
    currentFrameIndex: 0,
    speed: 1,
    viewMode: 'landing' as 'landing' | 'viewer',
    showPreRace: false,
    raceStarted: false,
    isReady: false,
  });
  kbRef.current = { isPlaying, currentFrameIndex, speed, viewMode, showPreRace, raceStarted, isReady };

  const sendActionRef = useRef(sendAction);
  useEffect(() => { sendActionRef.current = sendAction; });

  const handleRaceStartRef = useRef<() => void>(() => {});

  useEffect(() => {
    const SPEED_MAP: Record<string, number> = { '1': 0.5, '2': 1, '3': 2, '4': 4 };

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const kb = kbRef.current;
      if (kb.viewMode !== 'viewer') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (kb.showPreRace && kb.isReady) {
            handleRaceStartRef.current();
          } else if (kb.raceStarted) {
            if (kb.isPlaying) {
              sendActionRef.current({ action: 'pause' });
            } else {
              sendActionRef.current({ action: 'play', from_frame: kb.currentFrameIndex, speed: kb.speed });
            }
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          sendActionRef.current({ action: 'seek', to_frame: Math.max(0, kb.currentFrameIndex - (e.shiftKey ? 500 : 100)) });
          break;
        case 'ArrowRight':
          e.preventDefault();
          sendActionRef.current({ action: 'seek', to_frame: kb.currentFrameIndex + (e.shiftKey ? 500 : 100) });
          break;
        case '1': case '2': case '3': case '4': {
          const s = SPEED_MAP[e.key];
          setSpeed(s);
          sendActionRef.current({ action: 'set_speed', speed: s });
          break;
        }
        case 'f': case 'F':
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen().catch(() => {});
          break;
        case '?':
          setShowKeyboardHints(prev => !prev);
          break;
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []); // stable — all values accessed via refs

  // Show hints on first ever visit
  useEffect(() => {
    if (!localStorage.getItem('f1viewer_hints_shown')) {
      setShowKeyboardHints(true);
      localStorage.setItem('f1viewer_hints_shown', '1');
    }
  }, []);

  const totalLaps = metadata?.total_laps ?? 0;

  // Auto-show results when leader completes final lap
  useEffect(() => {
    if (!raceStarted || totalLaps === 0 || currentLap < totalLaps) return;
    const t = setTimeout(() => setShowResults(true), 2000);
    return () => clearTimeout(t);
  }, [currentLap, totalLaps, raceStarted]);

  function handleRaceSelect(year: number, round: number, name: string) {
    setSelectedDriver(null);
    setFollowingDriver(null);
    setSpeed(1);
    setRaceStarted(false);
    setShowPreRace(true);
    setShowResults(false);
    setSelectedRace({ year, round, name });
    setViewMode('viewer');
  }

  function handleBackToLanding() {
    setViewMode('landing');
    setSelectedRace(null);
    setSelectedDriver(null);
    setFollowingDriver(null);
    setRaceStarted(false);
    setShowPreRace(false);
    setShowResults(false);
    setMetadata(null);
  }

  function handleRaceStart() {
    setShowPreRace(false);
    setRaceStarted(true);
    sendAction({ action: 'play', from_frame: 0, speed: 1 });
  }
  handleRaceStartRef.current = handleRaceStart;

  const handleDriverClick = useCallback((code: string) => {
    setSelectedDriver(prev => (prev === code ? null : code));
    setFollowingDriver(prev => (prev === code ? null : code));
  }, []);

  const handleDriverClose = useCallback(() => setSelectedDriver(null), []);

  const driverColors = metadata?.driver_colors ?? EMPTY_COLORS;
  const trackPoints = metadata?.track_points ?? EMPTY_TRACK;
  const raceName = selectedRace?.name ?? '';
  const circuitLocation = raceName ? (CIRCUIT_LOCATIONS[raceName] ?? raceName) : '';

  return (
    <div style={{ height: '100dvh' }} className="flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Subtle dot-grid background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <TopNav
        mode={viewMode}
        currentRace={selectedRace ?? undefined}
        sessions={sessions}
        onBackToLanding={handleBackToLanding}
        onSelectRace={handleRaceSelect}
      />

      {/* ── Landing ────────────────────────────────────────────────────── */}
      {viewMode === 'landing' && (
        <div className="flex-1 min-h-0 overflow-y-auto z-10">
          <RaceCardGrid sessions={sessions} onSelectRace={handleRaceSelect} />
        </div>
      )}

      {/* ── Viewer ─────────────────────────────────────────────────────── */}
      {viewMode === 'viewer' && selectedRace && (
        <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden z-10">
          {/* Lap + leader info — only after race starts */}
          {raceStarted && (
            <TopBar currentFrameRef={currentFrameRef} totalLaps={totalLaps} />
          )}

          {/* Main content: tower + track */}
          <div className="relative flex flex-1 min-h-0 overflow-hidden">
            {/* Left column: The Grid */}
            <div className="relative flex-shrink-0" style={{ width: 220 }}>
              <TimingTower
                currentFrameRef={currentFrameRef}
                driverColors={driverColors}
                onDriverClick={handleDriverClick}
                selectedDriver={selectedDriver}
                followingDriver={followingDriver}
              />
            </div>

            {/* Center: track map */}
            <div className="flex-1 min-w-0 min-h-0">
              <TrackMap
                trackPoints={trackPoints}
                driverColors={driverColors}
                currentFrameRef={currentFrameRef}
                onDriverClick={handleDriverClick}
                raceName={raceName}
                followingDriver={followingDriver}
                onFollowChange={setFollowingDriver}
              />
            </div>

            {/* Driver detail — absolute right panel over the content area */}
            <DriverDetail
              driverCode={selectedDriver}
              driverColor={selectedDriver ? (driverColors[selectedDriver] ?? '#888888') : '#888888'}
              frameBufferRef={frameBufferRef}
              currentLap={currentLap}
              onClose={handleDriverClose}
            />

            {/* Quick guide — slides left when driver detail is open */}
            <TrackHint visible={raceStarted} driverPanelOpen={!!selectedDriver} />
          </div>

          {/* Bottom: playback bar */}
          <PlaybackBar
            currentFrameIndex={currentFrameIndex}
            totalFrames={totalFrames}
            currentLap={currentLap}
            totalLaps={totalLaps}
            currentT={currentT}
            isPlaying={isPlaying}
            isLoading={isLoading}
            isEnded={isEnded}
            speed={speed}
            onSpeedChange={setSpeed}
            sendAction={sendAction}
            onShowResults={() => setShowResults(true)}
          />

          {/* Pre-race card overlay */}
          <AnimatePresence>
            {showPreRace && (
              <PreRaceCard
                key={`prerace-${selectedRace.year}-${selectedRace.round}`}
                raceName={raceName}
                year={selectedRace.year}
                circuitLocation={circuitLocation}
                totalLaps={totalLaps}
                isReady={isReady}
                onStart={handleRaceStart}
              />
            )}
          </AnimatePresence>

          {/* Loading overlay before metadata arrives */}
          {metaLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/80 z-20">
              <span className="text-xs uppercase tracking-widest text-gray-500 animate-pulse">
                Loading race data…
              </span>
            </div>
          )}

          {/* Race results overlay */}
          <AnimatePresence>
            {showResults && metadata && (
              <RaceResults
                key={`results-${selectedRace.year}-${selectedRace.round}`}
                year={selectedRace.year}
                round={selectedRace.round}
                raceName={raceName}
                driverColors={driverColors}
                onClose={() => setShowResults(false)}
              />
            )}
          </AnimatePresence>

          {/* Connection error overlay */}
          {errorMessage && (
            <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
              <div
                className="flex flex-col items-center gap-5 rounded-2xl px-10 py-8 text-center"
                style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', maxWidth: 400 }}
              >
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{ width: 48, height: 48, background: 'rgba(225,6,0,0.12)', border: '1px solid rgba(225,6,0,0.3)' }}
                >
                  <svg viewBox="0 0 20 20" fill="#e10600" style={{ width: 22, height: 22 }}>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-10.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a1 1 0 110-2 1 1 0 010 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold text-white" style={{ fontSize: 15 }}>Viewer Unavailable</p>
                  <p className="text-gray-400 leading-snug" style={{ fontSize: 13 }}>{errorMessage}</p>
                </div>
                <button
                  onClick={handleBackToLanding}
                  className="rounded-lg font-semibold transition-colors duration-150 text-white"
                  style={{ padding: '10px 24px', fontSize: 13, background: '#e10600' }}
                >
                  Return to Race Selection
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <KeyboardHints show={showKeyboardHints} onClose={() => setShowKeyboardHints(false)} />
    </div>
  );
}

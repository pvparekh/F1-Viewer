import { AnimatePresence, motion } from 'framer-motion';
import { MutableRefObject, memo, useEffect, useRef, useState } from 'react';
import { Frame, TrackPoint } from '../types';

// ---------------------------------------------------------------------------
// Types & static data
// ---------------------------------------------------------------------------

interface Props {
  trackPoints: TrackPoint[];
  driverColors: Record<string, string>;
  currentFrameRef: MutableRefObject<Frame | null>;
  onDriverClick: (code: string) => void;
  raceName: string;
  followingDriver: string | null;
  onFollowChange: (code: string | null) => void;
}

interface Corner {
  name: string;
  frac: number;
}

const CIRCUIT_CORNERS: Record<string, Corner[]> = {
  monaco: [
    { name: 'Casino Square', frac: 0.30 },
    { name: 'Swimming Pool', frac: 0.60 },
    { name: 'Rascasse', frac: 0.85 },
  ],
  british: [
    { name: 'Copse', frac: 0.15 },
    { name: 'Maggots-Becketts', frac: 0.40 },
    { name: 'Stowe', frac: 0.70 },
  ],
  monza: [
    { name: 'Rettifilo', frac: 0.15 },
    { name: 'Lesmo', frac: 0.45 },
    { name: 'Parabolica', frac: 0.90 },
  ],
  bahrain: [
    { name: 'T1', frac: 0.10 },
    { name: 'T10', frac: 0.55 },
    { name: 'T13', frac: 0.75 },
  ],
};

function getCornersForRace(name: string): Corner[] {
  const n = name.toLowerCase();
  if (n.includes('monaco')) return CIRCUIT_CORNERS.monaco;
  if (n.includes('british') || n.includes('silverstone')) return CIRCUIT_CORNERS.british;
  if (n.includes('italian') || n.includes('monza')) return CIRCUIT_CORNERS.monza;
  if (n.includes('bahrain')) return CIRCUIT_CORNERS.bahrain;
  return [];
}

const DRIVER_NAMES: Record<string, string> = {
  VER: 'Max Verstappen', PER: 'Sergio Pérez', HAM: 'Lewis Hamilton',
  RUS: 'George Russell', LEC: 'Charles Leclerc', SAI: 'Carlos Sainz',
  NOR: 'Lando Norris', PIA: 'Oscar Piastri', ALO: 'Fernando Alonso',
  STR: 'Lance Stroll', GAS: 'Pierre Gasly', OCO: 'Esteban Ocon',
  ALB: 'Alexander Albon', SAR: 'Logan Sargeant', BOT: 'Valtteri Bottas',
  ZHO: 'Guanyu Zhou', TSU: 'Yuki Tsunoda', RIC: 'Daniel Ricciardo',
  MAG: 'Kevin Magnussen', HUL: 'Nico Hülkenberg', LAW: 'Liam Lawson',
  ANT: 'Kimi Antonelli', BEA: 'Oliver Bearman', DOO: 'Jack Doohan',
  HAD: 'Isack Hadjar', COL: 'Franco Colapinto',
};

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

interface Transform {
  toSVG: (x: number, y: number) => [number, number];
}

function buildTransform(pts: TrackPoint[], w: number, h: number): Transform {
  const margin = 0.05;
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const worldW = Math.max(1, maxX - minX);
  const worldH = Math.max(1, maxY - minY);
  const zoom = Math.min(
    (w * (1 - 2 * margin)) / worldW,
    (h * (1 - 2 * margin)) / worldH
  );
  const offX = w / 2 - zoom * ((minX + maxX) / 2);
  const offY = h / 2 - zoom * ((minY + maxY) / 2);
  return { toSVG: (x, y) => [zoom * x + offX, h - (zoom * y + offY)] };
}

function makePolylinePoints(pts: TrackPoint[], tx: Transform): string {
  return pts
    .map(p => {
      const [x, y] = tx.toSVG(p.x, p.y);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

const NS = 'http://www.w3.org/2000/svg';

function makeSVGText(
  x: number, y: number, content: string,
  opts: { fontSize?: number; anchor?: string; fill?: string; opacity?: string; bold?: boolean } = {}
): SVGTextElement {
  const el = document.createElementNS(NS, 'text');
  el.setAttribute('x', String(x));
  el.setAttribute('y', String(y));
  el.setAttribute('text-anchor', opts.anchor ?? 'middle');
  el.setAttribute('font-size', String(opts.fontSize ?? 10));
  el.setAttribute('fill', opts.fill ?? 'white');
  el.setAttribute('opacity', opts.opacity ?? '0.6');
  if (opts.bold) el.setAttribute('font-weight', 'bold');
  el.style.paintOrder = 'stroke fill';
  el.style.stroke = 'black';
  el.style.strokeWidth = '3px';
  el.style.strokeLinejoin = 'round';
  el.textContent = content;
  return el;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FRAME_MS = 100;
const MAX_BATTLE_LINES = 25;
const FOLLOW_ZOOM = 2.5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TrackMap = memo(function TrackMap({
  trackPoints,
  driverColors,
  currentFrameRef,
  onDriverClick,
  raceName,
  followingDriver,
  onFollowChange,
}: Props) {
  // ── DOM refs ───────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const trackRef = useRef<SVGPolylineElement>(null);
  const circleRefs = useRef<Record<string, SVGCircleElement>>({});
  const transformRef = useRef<Transform | null>(null);
  const rafRef = useRef<number>(0);
  const onClickRef = useRef(onDriverClick);
  onClickRef.current = onDriverClick;

  // ── Interaction / animation refs ──────────────────────────────────────────
  const sizeRef = useRef({ w: 800, h: 600 });
  const circlePositionsRef = useRef<Record<string, { cx: number; cy: number; pos: number }>>({});
  const battleLinesRef = useRef<SVGLineElement[]>([]);
  const hoveredCodeRef = useRef<string | null>(null);
  const hoverLabelRef = useRef<HTMLDivElement>(null);

  // Camera follow
  const viewBoxRef = useRef([0, 0, 800, 600]);
  const baseViewBoxRef = useRef([0, 0, 800, 600]);
  const lastAnimatedRaceRef = useRef('');
  const followRingOuterRef = useRef<SVGCircleElement | null>(null);
  const followRingInnerRef = useRef<SVGCircleElement | null>(null);

  // React state — only for re-renders that genuinely need them
  const [size, setSize] = useState({ w: 800, h: 600 });
  const followingDriverRef = useRef<string | null>(null);
  followingDriverRef.current = followingDriver;

  const onFollowChangeRef = useRef(onFollowChange);
  onFollowChangeRef.current = onFollowChange;

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        sizeRef.current = { w: width, h: height };
        setSize({ w: width, h: height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Update base viewBox on resize (snap current vb to base if not following)
  useEffect(() => {
    baseViewBoxRef.current = [0, 0, size.w, size.h];
    if (!followingDriverRef.current) {
      viewBoxRef.current = [0, 0, size.w, size.h];
    }
  }, [size]);

  // ── ESC key to exit follow ─────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFollowChangeRef.current(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ── Track + static decorations ─────────────────────────────────────────────
  useEffect(() => {
    if (trackPoints.length === 0 || size.w === 0) return;
    const svg = svgRef.current;
    if (!svg) return;

    const tx = buildTransform(trackPoints, size.w, size.h);
    transformRef.current = tx;

    const polyline = trackRef.current;
    if (polyline) {
      polyline.setAttribute('points', makePolylinePoints(trackPoints, tx));

      if (raceName !== lastAnimatedRaceRef.current) {
        lastAnimatedRaceRef.current = raceName;
        try {
          const len = polyline.getTotalLength();
          polyline.style.strokeDasharray = String(len);
          polyline.style.strokeDashoffset = String(len);
          polyline.style.transition = 'none';
          void polyline.getBoundingClientRect(); // force reflow
          polyline.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(0.4, 0, 0.2, 1)';
          polyline.style.strokeDashoffset = '0';
        } catch {
          polyline.style.strokeDasharray = '';
          polyline.style.strokeDashoffset = '0';
        }
      } else {
        // On resize: keep dashoffset at 0 without animation
        polyline.style.strokeDasharray = '';
        polyline.style.strokeDashoffset = '0';
        polyline.style.transition = 'none';
      }
    }

    svg.querySelector('#static-decorations')?.remove();
    const g = document.createElementNS(NS, 'g');
    g.id = 'static-decorations';

    // Start / finish
    if (trackPoints.length >= 2) {
      const p0 = trackPoints[0], p1 = trackPoints[1];
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const half = 200;
      const [x1, y1] = tx.toSVG(p0.x + nx * half, p0.y + ny * half);
      const [x2, y2] = tx.toSVG(p0.x - nx * half, p0.y - ny * half);
      const [lx, ly] = tx.toSVG(p0.x, p0.y);
      const sfLine = document.createElementNS(NS, 'line');
      sfLine.setAttribute('x1', String(x1.toFixed(1)));
      sfLine.setAttribute('y1', String(y1.toFixed(1)));
      sfLine.setAttribute('x2', String(x2.toFixed(1)));
      sfLine.setAttribute('y2', String(y2.toFixed(1)));
      sfLine.setAttribute('stroke', 'white');
      sfLine.setAttribute('stroke-width', '3');
      sfLine.setAttribute('stroke-dasharray', '8 8');
      sfLine.setAttribute('opacity', '0.5');
      g.appendChild(sfLine);
      g.appendChild(makeSVGText(lx, ly + 18, 'START/FINISH', { fontSize: 10, bold: true, opacity: '0.5' }));
    }

    // Famous corners
    for (const corner of getCornersForRace(raceName)) {
      const idx = Math.min(Math.floor(corner.frac * trackPoints.length), trackPoints.length - 1);
      const pt = trackPoints[idx];
      const [cx, cy] = tx.toSVG(pt.x, pt.y);
      g.appendChild(makeSVGText(cx, cy - 12, corner.name, { fontSize: 9, opacity: '0.45' }));
    }

    // Pit lane (Monaco only)
    if (raceName.toLowerCase().includes('monaco') && trackPoints.length > 10) {
      const pitEnd = Math.max(1, Math.floor(0.04 * trackPoints.length));
      const p0 = trackPoints[0], pEnd = trackPoints[pitEnd];
      const dx = pEnd.x - p0.x, dy = pEnd.y - p0.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const off = 250;
      const pitPtsStr = trackPoints.slice(0, pitEnd + 1)
        .map(pt => {
          const [x, y] = tx.toSVG(pt.x + nx * off, pt.y + ny * off);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
      const pitLine = document.createElementNS(NS, 'polyline');
      pitLine.setAttribute('points', pitPtsStr);
      pitLine.setAttribute('fill', 'none');
      pitLine.setAttribute('stroke', '#aaaaaa');
      pitLine.setAttribute('stroke-width', '1.5');
      pitLine.setAttribute('stroke-dasharray', '4 4');
      pitLine.setAttribute('opacity', '0.35');
      g.appendChild(pitLine);
      const mid = Math.floor(pitEnd / 2);
      const [mlx, mly] = tx.toSVG(trackPoints[mid].x + nx * off, trackPoints[mid].y + ny * off);
      g.appendChild(makeSVGText(mlx, mly - 7, 'PIT LANE', { fontSize: 8, fill: '#aaaaaa', opacity: '0.45' }));
    }

    const driversLayer = svg.querySelector('#drivers-layer');
    svg.insertBefore(g, driversLayer ?? null);
    return () => g.remove();
  }, [trackPoints, size, raceName]);

  // ── Driver circles + battle lines pool ────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    svg.querySelector('#drivers-layer')?.remove();
    circleRefs.current = {};
    circlePositionsRef.current = {};
    battleLinesRef.current = [];

    const codes = Object.keys(driverColors);
    if (codes.length === 0) return;

    const g = document.createElementNS(NS, 'g');
    g.id = 'drivers-layer';

    // Battle lines pool
    const battleGroup = document.createElementNS(NS, 'g');
    battleGroup.id = 'battle-lines';
    for (let i = 0; i < MAX_BATTLE_LINES; i++) {
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', '-9999'); line.setAttribute('y1', '-9999');
      line.setAttribute('x2', '-9999'); line.setAttribute('y2', '-9999');
      line.setAttribute('stroke', '#FFD700');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '4 4');
      line.setAttribute('opacity', '0');
      battleGroup.appendChild(line);
      battleLinesRef.current.push(line);
    }
    g.appendChild(battleGroup);

    // Driver circles
    for (const code of codes) {
      const circle = document.createElementNS(NS, 'circle');
      circle.style.r = '4px';
      circle.style.transition = 'r 150ms ease';
      circle.setAttribute('fill', driverColors[code]);
      circle.setAttribute('cx', '-9999');
      circle.setAttribute('cy', '-9999');
      circle.style.cursor = 'pointer';

      circle.addEventListener('mouseenter', () => {
        circle.style.r = '6px';
        circle.setAttribute('stroke', '#ffffff');
        circle.setAttribute('stroke-width', '2');
        hoveredCodeRef.current = code;
        if (hoverLabelRef.current) hoverLabelRef.current.style.display = 'block';
      });
      circle.addEventListener('mouseleave', () => {
        circle.style.r = '4px';
        circle.removeAttribute('stroke');
        hoveredCodeRef.current = null;
        if (hoverLabelRef.current) hoverLabelRef.current.style.display = 'none';
      });
      circle.addEventListener('click', e => {
        e.stopPropagation();
        onClickRef.current(code);
      });

      circleRefs.current[code] = circle;
      g.appendChild(circle);
    }

    svg.appendChild(g);
    return () => {
      g.remove();
      circleRefs.current = {};
      battleLinesRef.current = [];
    };
  }, [driverColors]);

  // ── Follow ring indicator elements ────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const g = document.createElementNS(NS, 'g');
    g.id = 'follow-indicator';

    const outer = document.createElementNS(NS, 'circle');
    outer.setAttribute('r', '12');
    outer.setAttribute('fill', 'none');
    outer.setAttribute('stroke', 'white');
    outer.setAttribute('stroke-width', '1.5');
    outer.setAttribute('cx', '-9999');
    outer.setAttribute('cy', '-9999');
    outer.setAttribute('opacity', '0');
    outer.classList.add('follow-ring-pulse');
    g.appendChild(outer);
    followRingOuterRef.current = outer;

    const inner = document.createElementNS(NS, 'circle');
    inner.setAttribute('r', '7');
    inner.setAttribute('fill', 'none');
    inner.setAttribute('stroke', 'white');
    inner.setAttribute('stroke-width', '1');
    inner.setAttribute('cx', '-9999');
    inner.setAttribute('cy', '-9999');
    inner.setAttribute('opacity', '0');
    g.appendChild(inner);
    followRingInnerRef.current = inner;

    svg.appendChild(g);
    return () => {
      g.remove();
      followRingOuterRef.current = null;
      followRingInnerRef.current = null;
    };
  }, []);

  // ── 60 FPS: interpolation + camera follow + battle lines + hover ──────────
  useEffect(() => {
    let frameA: Frame | null = null;
    let frameB: Frame | null = null;
    let lastSeenT = -1;
    let receiveTime = 0;

    function tick(now: number) {
      const curr = currentFrameRef.current;
      if (curr && curr.t !== lastSeenT) {
        frameA = frameB;
        frameB = curr;
        receiveTime = now;
        lastSeenT = curr.t;
      }

      const tx = transformRef.current;
      const svg = svgRef.current;

      if (tx && frameB) {
        const tInterp = frameA ? Math.min(1, (now - receiveTime) / FRAME_MS) : 1;
        const { w, h } = sizeRef.current;

        // ── Driver positions ──────────────────────────────────────────────
        for (const [code, el] of Object.entries(circleRefs.current)) {
          const b = frameB.drivers[code];
          if (!b) {
            el.setAttribute('cx', '-9999');
            el.setAttribute('cy', '-9999');
            circlePositionsRef.current[code] = { cx: -9999, cy: -9999, pos: 99 };
            continue;
          }
          const a = frameA?.drivers[code];
          const wx = a ? lerp(a.x, b.x, tInterp) : b.x;
          const wy = a ? lerp(a.y, b.y, tInterp) : b.y;
          const [cx, cy] = tx.toSVG(wx, wy);
          el.setAttribute('cx', cx.toFixed(2));
          el.setAttribute('cy', cy.toFixed(2));
          circlePositionsRef.current[code] = { cx, cy, pos: b.pos };
        }

        // ── Battle lines ──────────────────────────────────────────────────
        const visible = Object.entries(circlePositionsRef.current).filter(
          ([, p]) => p.cx > 0 && p.cx < w && p.cy > 0 && p.cy < h
        );
        visible.sort(([, a], [, b]) => a.pos - b.pos);
        const threshold = Math.min(w, h) * 0.04;
        let lineIdx = 0;
        for (let i = 0; i < visible.length - 1 && lineIdx < battleLinesRef.current.length; i++) {
          const pA = visible[i][1], pB = visible[i + 1][1];
          const dx = pA.cx - pB.cx, dy = pA.cy - pB.cy;
          if (Math.sqrt(dx * dx + dy * dy) < threshold) {
            const l = battleLinesRef.current[lineIdx++];
            l.setAttribute('x1', pA.cx.toFixed(1));
            l.setAttribute('y1', pA.cy.toFixed(1));
            l.setAttribute('x2', pB.cx.toFixed(1));
            l.setAttribute('y2', pB.cy.toFixed(1));
            l.setAttribute('opacity', '0.6');
          }
        }
        for (let i = lineIdx; i < battleLinesRef.current.length; i++) {
          battleLinesRef.current[i].setAttribute('opacity', '0');
        }

        // ── Hover label ───────────────────────────────────────────────────
        const hovered = hoveredCodeRef.current;
        const labelEl = hoverLabelRef.current;
        if (hovered && labelEl) {
          const p = circlePositionsRef.current[hovered];
          if (p && p.cx > 0) {
            const pos = frameB.drivers[hovered]?.pos;
            const newText = pos != null ? `P${pos} · ${hovered}` : hovered;
            if (labelEl.textContent !== newText) labelEl.textContent = newText;
            labelEl.style.left = `${p.cx}px`;
            labelEl.style.top = `${p.cy}px`;
          }
        }

        // ── Camera follow viewBox ──────────────────────────────────────────
        if (svg) {
          const following = followingDriverRef.current;
          const vb = viewBoxRef.current;
          const baseVB = baseViewBoxRef.current;

          if (following) {
            const pos = circlePositionsRef.current[following];
            // Auto-exit if driver vanishes from data
            if (!pos || pos.cx <= -100) {
              onFollowChangeRef.current(null);
            } else {
              const targetW = w / FOLLOW_ZOOM;
              const targetH = h / FOLLOW_ZOOM;
              const targetX = Math.max(0, Math.min(w - targetW, pos.cx - targetW / 2));
              const targetY = Math.max(0, Math.min(h - targetH, pos.cy - targetH / 2));
              vb[0] += (targetX - vb[0]) * 0.12;
              vb[1] += (targetY - vb[1]) * 0.12;
              vb[2] += (targetW - vb[2]) * 0.12;
              vb[3] += (targetH - vb[3]) * 0.12;
            }
          } else {
            vb[0] += (baseVB[0] - vb[0]) * 0.1;
            vb[1] += (baseVB[1] - vb[1]) * 0.1;
            vb[2] += (baseVB[2] - vb[2]) * 0.1;
            vb[3] += (baseVB[3] - vb[3]) * 0.1;
          }
          svg.setAttribute('viewBox', vb.join(' '));

          // ── Follow ring position ─────────────────────────────────────────
          const outer = followRingOuterRef.current;
          const inner = followRingInnerRef.current;
          if (outer && inner) {
            if (following) {
              const pos = circlePositionsRef.current[following];
              if (pos && pos.cx > 0) {
                outer.setAttribute('cx', pos.cx.toFixed(2));
                outer.setAttribute('cy', pos.cy.toFixed(2));
                inner.setAttribute('cx', pos.cx.toFixed(2));
                inner.setAttribute('cy', pos.cy.toFixed(2));
                outer.setAttribute('opacity', '1');
                inner.setAttribute('opacity', '0.8');
              }
            } else {
              outer.setAttribute('opacity', '0');
              inner.setAttribute('opacity', '0');
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [currentFrameRef]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        style={{
          display: 'block',
          background: '#0a0a0a',
          cursor: followingDriver ? 'zoom-out' : 'default',
        }}
        onClick={() => onFollowChangeRef.current(null)}
      >
        <polyline
          ref={trackRef}
          points=""
          fill="none"
          stroke="#4a4a4a"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* #static-decorations, #drivers-layer, #follow-indicator injected imperatively */}
      </svg>

      {/* Hover label */}
      <div
        ref={hoverLabelRef}
        className="pointer-events-none absolute z-40 hidden rounded-md bg-black/90 border border-white/10 px-2 py-0.5 text-xs font-semibold text-white whitespace-nowrap"
        style={{ transform: 'translate(-50%, calc(-100% - 10px))' }}
      />

      {/* Following badge */}
      <AnimatePresence>
        {followingDriver && (
          <motion.div
            key="follow-badge"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute top-4 left-1/2 z-30 -translate-x-1/2"
          >
            <div
              className="flex items-center gap-3 rounded-full border border-white/10 px-4 py-2"
              style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs uppercase tracking-widest text-gray-400">Following</span>
              </div>
              <span className="text-sm font-semibold text-white">
                {DRIVER_NAMES[followingDriver] ?? followingDriver}
              </span>
              <span className="font-mono text-xs text-gray-500">ESC</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default TrackMap;

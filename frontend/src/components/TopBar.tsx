import { MutableRefObject, useEffect, useState } from 'react';
import { Frame } from '../types';

interface Props {
  currentFrameRef: MutableRefObject<Frame | null>;
  totalLaps: number;
}

interface Info {
  lap: number;
  leaderCode: string;
  p2Code: string;
}

export default function TopBar({ currentFrameRef, totalLaps }: Props) {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const frame = currentFrameRef.current;
      if (!frame) return;

      const sorted = Object.entries(frame.drivers).sort(
        ([, a], [, b]) => a.pos - b.pos
      );

      setInfo({
        lap: frame.lap,
        leaderCode: sorted[0]?.[0] ?? '—',
        p2Code: sorted[1]?.[0] ?? '—',
      });
    }, 500);

    return () => clearInterval(id);
  }, [currentFrameRef]);

  if (!info) return null;

  return (
    <div
      className="flex-shrink-0 flex items-center justify-center gap-4 py-2 text-sm font-semibold tracking-wide text-white"
      style={{ background: 'rgba(0,0,0,0.65)', fontSize: 15 }}
    >
      <span className="text-[#888888]">
        LAP <span className="text-white">{info.lap}</span>
        <span className="text-[#555555]">/{totalLaps}</span>
      </span>

      <span className="text-[#242424]">·</span>

      <span>
        <span className="text-[#E10600] font-black mr-1">{info.leaderCode}</span>
        <span className="text-[#888888] text-xs">P1</span>
      </span>

      <span className="text-[#242424]">·</span>

      <span>
        <span className="text-white mr-1">{info.p2Code}</span>
        <span className="text-[#888888] text-xs">P2</span>
      </span>
    </div>
  );
}

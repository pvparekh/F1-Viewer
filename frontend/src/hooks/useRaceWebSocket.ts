import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { BUFFER_SIZE, ClientAction, Frame, FrameBuffer } from '../types';

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8000';
const MAX_RECONNECT_DELAY_MS = 10_000;

export interface UseRaceWebSocketReturn {
  currentFrameRef: MutableRefObject<Frame | null>;
  frameBufferRef: MutableRefObject<FrameBuffer>;
  currentFrameIndex: number;
  totalFrames: number;
  currentLap: number;
  currentT: number;
  isPlaying: boolean;
  isLoading: boolean;
  isEnded: boolean;
  errorMessage: string | null;
  sendAction: (action: ClientAction) => void;
}

export function useRaceWebSocket(
  year: number | null,
  round: number | null
): UseRaceWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1_000);
  const isMountedRef = useRef(true);
  const shouldReconnectRef = useRef(true);

  const currentFrameRef = useRef<Frame | null>(null);
  const frameBufferRef = useRef<FrameBuffer>({
    frames: new Array(BUFFER_SIZE).fill(null),
    writeIdx: 0,
    count: 0,
  });

  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [currentLap, setCurrentLap] = useState(1);
  const [currentT, setCurrentT] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const sendAction = useCallback((action: ClientAction) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (action.action === 'play') setIsPlaying(true);
    if (action.action === 'pause') setIsPlaying(false);
    ws.send(JSON.stringify(action));
  }, []);

  useEffect(() => {
    if (year === null || round === null) return;

    // Reset all state for the new race
    currentFrameRef.current = null;
    frameBufferRef.current = {
      frames: new Array(BUFFER_SIZE).fill(null),
      writeIdx: 0,
      count: 0,
    };
    setCurrentFrameIndex(0);
    setTotalFrames(0);
    setCurrentLap(1);
    setCurrentT(0);
    setIsPlaying(false);
    setIsLoading(false);
    setIsEnded(false);
    setErrorMessage(null);
    reconnectDelayRef.current = 1_000;
    shouldReconnectRef.current = true;

    function connect() {
      if (!isMountedRef.current || !shouldReconnectRef.current) return;

      const ws = new WebSocket(`${WS_URL}/ws/sessions/${year}/${round}/replay`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) { ws.close(1000); return; }
        reconnectDelayRef.current = 1_000;
        setIsPlaying(false);
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        if (!isMountedRef.current) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(event.data) as Record<string, unknown>;
        } catch {
          return;
        }

        if (msg.type === 'status') {
          const status = msg.status as string;
          if (status === 'loading') setIsLoading(true);
          if (status === 'ready') setIsLoading(false);
          if (status === 'ended') {
            setIsPlaying(false);
            setIsEnded(true);
          }
          if (status === 'error') {
            setIsLoading(false);
            setErrorMessage((msg.message as string | undefined) ?? 'Connection error');
          }
        } else if (msg.type === 'total_frames') {
          setTotalFrames(msg.total_frames as number);
        } else if (msg.type === 'frame') {
          const frame: Frame = {
            t: msg.t as number,
            lap: msg.lap as number,
            drivers: msg.drivers as Frame['drivers'],
          };

          currentFrameRef.current = frame;

          const buf = frameBufferRef.current;
          buf.frames[buf.writeIdx % BUFFER_SIZE] = frame;
          buf.writeIdx++;
          if (buf.count < BUFFER_SIZE) buf.count++;

          setCurrentFrameIndex(msg.frame_index as number);
          setCurrentLap(msg.lap as number);
          setCurrentT(msg.t as number);
        }
      };

      ws.onclose = (event: CloseEvent) => {
        if (!isMountedRef.current || !shouldReconnectRef.current) return;
        // Don't reconnect on intentional or server policy closes
        if (event.code === 1000 || event.code === 1008 || event.code === 1011) return;

        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose fires after onerror and handles reconnect
      };
    }

    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close(1000);
        wsRef.current = null;
      }
    };
  }, [year, round]);

  return {
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
  };
}

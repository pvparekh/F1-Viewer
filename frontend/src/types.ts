export interface Session {
  year: number;
  round: number;
  name: string;
}

export interface TrackPoint {
  x: number;
  y: number;
}

export interface DriverFrame {
  x: number;
  y: number;
  pos: number;
}

export interface Frame {
  t: number;
  lap: number;
  drivers: Record<string, DriverFrame>;
}

export interface RaceMetadata {
  year: number;
  round: number;
  name: string;
  total_frames: number;
  total_laps: number;
  drivers: string[];
  driver_colors: Record<string, string>;
  track_points: TrackPoint[];
  approximate_duration_seconds: number;
}

export type ClientAction =
  | { action: 'play'; from_frame: number; speed: number }
  | { action: 'pause' }
  | { action: 'seek'; to_frame: number }
  | { action: 'set_speed'; speed: number };

export interface RaceResultRow {
  position: number | null;
  driver_number: string;
  abbreviation: string;
  full_name: string;
  team: string;
  time: string | null;
  status: string;
  points: number;
}

export const BUFFER_SIZE = 5000;

export interface FrameBuffer {
  frames: (Frame | null)[];
  writeIdx: number;
  count: number;
}

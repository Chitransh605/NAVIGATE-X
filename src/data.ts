/* Navigate-X · AI Perception — SIMULATION MODE
   Replace SAMPLE with the FastAPI WebSocket payload when the backend is ready. */
export type Level = 'green' | 'yellow' | 'orange' | 'red';

export interface Detection {
  id: string; cls: string; label: string; conf: number;
  x: number; y: number; w: number; h: number; // % of frame
  lvl: Level; onPath: boolean; isNew: boolean;
  d: number; // monocular depth estimate in metres, uncalibrated
  impact: string; act: string;
}

export const DETECTIONS: Detection[] = [
  { id: 'H-01', cls: 'Rock', label: 'Rock', conf: 0.89, x: 4, y: 48, w: 22, h: 28, lvl: 'orange', onPath: false, isNew: false, d: 4.2, impact: 'Close to left route edge', act: 'Keep lateral clearance' },
  { id: 'H-02', cls: 'Rock', label: 'Rock', conf: 0.83, x: 80, y: 57, w: 16, h: 19, lvl: 'yellow', onPath: false, isNew: false, d: 5.1, impact: 'Near right route edge', act: 'Slow down when passing' },
  { id: 'H-03', cls: 'Tree', label: 'Tree', conf: 0.76, x: 61, y: 27, w: 8, h: 25, lvl: 'green', onPath: false, isNew: false, d: 7.8, impact: 'Off route', act: 'No change needed' },
  { id: 'H-04', cls: 'Rock', label: 'Rock', conf: 0.94, x: 60, y: 52, w: 12, h: 8, lvl: 'orange', onPath: true, isNew: true, d: 6.3, impact: 'Potential obstruction', act: 'Evaluate alternative route' },
  { id: 'H-05', cls: 'Bush', label: 'Bush', conf: 0.68, x: 20, y: 84, w: 15, h: 14, lvl: 'green', onPath: false, isNew: false, d: 3.4, impact: 'Off route', act: 'No change needed' },
  { id: 'H-06', cls: 'Unknown', label: 'Unknown Object', conf: 0.61, x: 45, y: 53, w: 6, h: 6, lvl: 'yellow', onPath: true, isNew: true, d: 9.1, impact: 'Needs inspection', act: 'Re-check at closer range' },
];

export const TERRAIN: [string, number, string][] = [
  ['Traversable ground', 34, '#22c55e'], ['Grass', 22, '#84cc16'], ['Soil', 9, '#a16207'],
  ['Gravel', 6, '#94a3b8'], ['Rocks', 17, '#ef4444'], ['Vegetation', 9, '#16a34a'], ['Unknown', 3, '#64748b'],
];

export const LEVELS: Record<Level, [string, string]> = {
  green: ['Low concern', '#22c55e'], yellow: ['Caution', '#facc15'],
  orange: ['Potential hazard', '#fb923c'], red: ['High priority', '#ef4444'],
};

export type Sev = 'ok' | 'info' | 'warn' | 'crit';
export const EVENTS: [string, Sev, string][] = [
  ['New obstacle detected', 'warn', 'H-04 rock appeared near the planned route.'],
  ['Terrain classification updated', 'info', 'Segmentation refreshed for the current frame.'],
  ['Potential hazard identified', 'crit', 'Object overlaps the route corridor.'],
  ['Low-confidence detection', 'warn', 'Unknown object at 61%. Needs inspection.'],
  ['Camera frame received', 'ok', 'Frame accepted, 1280 × 720.'],
  ['AI model temporarily unavailable', 'crit', 'Inference skipped for one frame (simulated).'],
];
export const SEV: Record<Sev, string> = { ok: '#22c55e', info: '#3b82f6', warn: '#facc15', crit: '#fb923c' };

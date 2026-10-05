import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, BarChart3, Bell, BrainCircuit, Camera, Cpu, FlaskConical, Flag, Gauge as GaugeIcon, History,
  Home, Info, ListChecks, LocateOff, Maximize, Mountain, OctagonAlert, Pause, Play, Radar as RadarIcon,
  RadioTower, RotateCcw, Route, Ruler, SatelliteDish, ScanEye, ScanSearch, Settings, Sparkles, TreePine,
  TriangleAlert, User, HelpCircle, Boxes, Map as MapIcon, type LucideIcon,
} from 'lucide-react';
import { DETECTIONS, EVENTS, LEVELS, SEV, TERRAIN, type Detection, type Level } from './data';

/* ---------- helpers ---------- */
const N = 36;
const pad = (n: number) => String(n).padStart(2, '0');
const hms = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const mk = (a: number, b: number) => Array.from({ length: N }, () => rnd(a, b));
const walk = (a: number[], d: number) => [...a.slice(1), Math.min(0.97, Math.max(0.7, a[N - 1] + rnd(-d, d)))];
const ORDER: Level[] = ['red', 'orange', 'yellow', 'green'];
const ALL_CATS = [...new Set(DETECTIONS.map(d => d.cls))];
const DEFAULT_THR = 0.6;

type Decision = ['GO' | 'SLOW' | 'REROUTE' | 'STOP', Level | 'green', string];
function decide(v: Detection[]): Decision {
  const blk = v.filter(d => d.onPath && (d.lvl === 'orange' || d.lvl === 'red'));
  if (blk.filter(d => d.lvl === 'red').length && blk.length > 1)
    return ['STOP', 'red', 'No sufficiently safe route can be established with the current detections.'];
  if (blk.length) return ['REROUTE', 'orange', `${blk[0].id} (${blk[0].label}) may obstruct the planned route.`];
  if (v.some(d => d.lvl === 'yellow' || d.lvl === 'orange' || d.onPath))
    return ['SLOW', 'yellow', 'A caution condition was identified near the route.'];
  return ['GO', 'green', 'No detected condition currently requires a navigation change. Absence of detections is not proof of safety.'];
}

/* ---------- small components ---------- */
function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="sw">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span />
      {label}
    </label>
  );
}

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="gauge">
      <small>{label} confidence</small>
      <svg viewBox="0 0 84 84">
        <circle cx="42" cy="42" r="34" fill="none" stroke="#12243d" strokeWidth="7" />
        <circle cx="42" cy="42" r="34" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(value * 213.6 * 0.75).toFixed(1)} 300`} transform="rotate(135 42 42)" />
        <text x="42" y="49" textAnchor="middle">{value.toFixed(2)}</text>
      </svg>
    </div>
  );
}

function Chart({ lines, min, max, bars }: { lines: { data: number[]; color: string }[]; min: number; max: number; bars?: boolean }) {
  const y = (v: number) => (105 - ((v - min) / (max - min)) * 100).toFixed(1);
  return (
    <svg viewBox="0 0 300 110" preserveAspectRatio="none">
      <g stroke="#12243d" strokeWidth=".6"><path d="M0 28H300M0 55H300M0 82H300" /></g>
      {bars
        ? lines[0].data.map((v, i) => <rect key={i} x={((i / N) * 300 + 1).toFixed(1)} y={y(v)} width="6" height={(105 - +y(v)).toFixed(1)} rx="1.5" fill={lines[0].color} opacity=".85" />)
        : lines.map((l, k) => <polyline key={k} fill="none" stroke={l.color} strokeWidth="1.8" points={l.data.map((v, i) => `${((i / (N - 1)) * 300).toFixed(1)},${y(v)}`).join(' ')} />)}
    </svg>
  );
}

function RadarView({ items }: { items: Detection[] }) {
  return (
    <svg className="radar" viewBox="-100 -10 200 110" aria-label="Top-down obstacle diagram">
      <path d="M0 95 L-64 18 A100 100 0 0 1 64 18Z" fill="rgba(34,211,238,.06)" stroke="rgba(34,211,238,.25)" strokeWidth=".5" />
      {[30, 60, 90].map(r => (
        <g key={r}>
          <path d={`M${-r * 0.77} ${95 - r * 0.64} A${r} ${r} 0 0 1 ${r * 0.77} ${95 - r * 0.64}`} fill="none" stroke="#1d416b" strokeWidth=".5" strokeDasharray="2 2" />
          <text x={r * 0.77 + 2} y={95 - r * 0.64}>~{r / 10} m</text>
        </g>
      ))}
      <path d="M0 95 C-6 70 6 50 0 14" fill="none" stroke="#22d3ee" strokeWidth="1.4" strokeDasharray="3 2" />
      {items.map(d => {
        const a = (((d.x + d.w / 2 - 50) / 50) * 40 * Math.PI) / 180, r = d.d * 10;
        const x = r * Math.sin(a), y = 95 - r * Math.cos(a);
        return (
          <g key={d.id}>
            <circle cx={x} cy={y} r={d.onPath ? 5 : 3.6} fill={LEVELS[d.lvl][1]} fillOpacity=".85" stroke="#fff" strokeWidth=".5" />
            <text x={x + 6} y={y + 2}>{d.id}</text>
          </g>
        );
      })}
      <path d="M-6 100 L0 88 L6 100Z" fill="#fff" />
      <text x="-12" y="108">Robot</text>
    </svg>
  );
}

/* ---------- page ---------- */
const NAV: [string, LucideIcon][] = [
  ['Overview', Home], ['Live Navigation', RadioTower], ['Terrain Map', MapIcon], ['AI Perception', ScanEye],
  ['Missions', Flag], ['Analytics', BarChart3], ['Event History', History], ['Settings', Settings],
];
const TABS = [
  ['path', 'Path Segmentation', 'path_segmentation.jpg', 'Marks the area likely to be traversable. Needs route validation.', 'Conf 0.92 · sample'],
  ['det', 'Object Detection', 'detection.jpg', 'Rocks, trees and other objects that may affect the route.', 'Conf 0.89 · sample'],
  ['depth', 'Depth Estimation', 'depth.jpg', 'Relative depth from a single camera. Not metric until calibrated.', 'Conf 0.78 · estimate'],
  ['terrain', 'Terrain Risk Map', 'map_terrain.jpg', 'Roughness-based cost map with a candidate route from start to goal.', 'Conf 0.84 · sample'],
] as const;

export default function App() {
  const camCard = useRef<HTMLElement>(null);
  const [now, setNow] = useState(new Date());
  const [thr, setThr] = useState(DEFAULT_THR);
  const [boxes, setBoxes] = useState(true);
  const [labels, setLabels] = useState(true);
  const [seg, setSeg] = useState(true);
  const [view, setView] = useState<'overlay' | 'original'>('overlay');
  const [cats, setCats] = useState<Set<string>>(new Set(ALL_CATS));
  const [paused, setPaused] = useState(false);
  const [rear, setRear] = useState(false);
  const [tab, setTab] = useState<string>('path');
  const [s, setS] = useState({ lat: mk(38, 48), cp: mk(0.9, 0.94), cd: mk(0.86, 0.92), ct: mk(0.8, 0.86), fp: mk(22, 26) });
  const [events, setEvents] = useState(() => [4, 1, 3, 0, 2].map((i, k) => ({ i, t: new Date(Date.now() - (5 - k) * 23000) })).reverse());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      if (paused) return;
      setS(p => ({ lat: [...p.lat.slice(1), rnd(38, 48)], fp: [...p.fp.slice(1), Math.round(rnd(22, 26))], cp: walk(p.cp, 0.015), cd: walk(p.cd, 0.015), ct: walk(p.ct, 0.015) }));
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!paused) setEvents(e => [{ i: Math.floor(rnd(0, EVENTS.length)), t: new Date() }, ...e].slice(0, 30));
    }, 7000);
    return () => clearInterval(id);
  }, [paused]);

  const v = useMemo(() => DETECTIONS.filter(d => d.conf >= thr && cats.has(d.cls)), [thr, cats]);
  const sorted = useMemo(() => [...v].sort((a, b) => ORDER.indexOf(a.lvl) - ORDER.indexOf(b.lvl)), [v]);
  const [dk, dc, dwhy] = decide(v);
  const lat = s.lat[N - 1], fps = s.fp[N - 1];
  const mean = v.length ? v.reduce((a, d) => a + d.conf, 0) / v.length : 0;
  const count = (c: string) => v.filter(d => d.cls === c).length;
  const concern = v.filter(d => d.cls !== 'Tree' && d.lvl !== 'green').length;

  const reset = () => {
    setThr(DEFAULT_THR); setBoxes(true); setLabels(true); setSeg(true); setView('overlay');
    setCats(new Set(ALL_CATS)); setPaused(false); setRear(false);
  };
  const toggleCat = (c: string) => setCats(p => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : camCard.current?.requestFullscreen?.());

  const insights: [string, string, string, LucideIcon, string][] = [
    ['Path analysis', 'CANDIDATE', 'green', Route, 'Segmentation found a traversable corridor. It still needs validation by the planner.'],
    ['Obstacle analysis', concern ? 'DETECTED' : 'CLEAR', concern ? 'orange' : 'green', OctagonAlert, concern ? `${concern} object(s) of concern near the route. Rerouting may be required.` : 'No objects of concern above the threshold.'],
    ['Terrain analysis', 'MODERATE', 'yellow', Mountain, 'Uneven terrain (sample roughness 0.42). Grass cover may hide soft ground. Proceed with caution.'],
    ['Localization', 'NOT CONNECTED', 'gray', LocateOff, 'ORB-SLAM3 is not connected in this build, so no localization health is reported.'],
  ];
  const kpis: [string, number, string][] = [
    ['Total detected objects', v.length, 'cyan'], ['Hazards near route', v.filter(d => d.onPath).length, 'orange'],
    ['Newly detected', v.filter(d => d.isNew).length, 'blue'], ['High-priority hazards', v.filter(d => d.lvl === 'orange' || d.lvl === 'red').length, 'red'],
    ['Need inspection', v.filter(d => d.conf < 0.7).length, 'yellow'],
  ];
  const counts: [string, number, string, LucideIcon][] = [
    ['Rocks', count('Rock'), 'red', Mountain], ['Trees', count('Tree'), 'green', TreePine],
    ['Other', count('Bush'), 'orange', TriangleAlert], ['Unknown', count('Unknown'), 'gray', HelpCircle],
  ];

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <img src="/assets/logo.jpeg" alt="Navigate-X logo" />
          <div><b>NAVIGATE-X</b></div>
        </div>
        <div className="pills">
          <span className="pill red"><SatelliteDish />GPS: DENIED</span>
          <span className="pill yellow"><Camera />Camera: SIMULATED</span>
          <span className="pill yellow"><Cpu />AI Engine: SAMPLE DATA</span>
          <span className="pill gray"><LocateOff />Localization: N/A</span>
        </div>
        <div className="top-right">
          <select aria-label="Robot"><option>UGV-01</option><option>UGV-02</option></select>
          <span className="mode" title="Data on this page is simulated"><FlaskConical />Simulation Mode</span>
          <button className="icon-btn" aria-label="Notifications"><Bell /><em>3</em></button>
          <div className="clock"><b>{hms(now)}</b><span>{now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
          <div className="avatar"><User /></div>
        </div>
      </header>

      <div className="shell">
        <aside className="side">
          <nav>
            {NAV.map(([name, Icon]) => (
              <a key={name} href="#" className={name === 'AI Perception' ? 'active' : ''} onClick={e => e.preventDefault()}><Icon />{name}</a>
            ))}
          </nav>
          <div className="side-foot">
            <svg viewBox="0 0 200 70" className="mtn" aria-hidden="true"><path d="M0 70 L50 18 L72 40 L105 4 L150 52 L172 34 L200 70Z" fill="none" stroke="#1d6fd8" strokeWidth="2.5" strokeLinejoin="round" /></svg>
            <b>Navigate-X</b><span>Autonomous Navigation System</span>
            <div className="conn"><i />Backend: Not connected</div>
            <div className="conn amber"><i />Mode: Simulation</div>
            <small>v1.0.0</small>
          </div>
        </aside>

        <main>
          <div className="page-head">
            <div className="ph-icon"><ScanEye /></div>
            <div>
              <div className="crumb">Dashboard / AI Perception</div>
              <h1>AI Perception &amp; Environment Understanding</h1>
              <p>Computer vision analysis for path detection, obstacle recognition and terrain understanding.</p>
            </div>
            <div className="ph-tools">
              <div className="chip-box"><i className={'dot' + (paused ? '' : ' live')} /><span>{paused ? 'Paused' : 'Processing'}</span><b>FPS: {fps}</b></div>
              <select aria-label="Select camera" value={rear ? 'rear' : 'front'} onChange={e => setRear(e.target.value === 'rear')}>
                <option value="front">Camera View: Front</option><option value="rear">Camera View: Rear (not connected)</option>
              </select>
              <div className="seg">
                {(['overlay', 'original'] as const).map(x => <button key={x} className={view === x ? 'on' : ''} onClick={() => setView(x)}>{x === 'overlay' ? 'Overlay' : 'Original'}</button>)}
              </div>
            </div>
          </div>

          <div className="sim-banner"><Info /><span><b>Simulation Mode.</b> The detections, masks and statistics shown here are sample data on a still image, not live robot observations. Detection confidence is not safety confidence: a path is never declared safe by detection alone.</span></div>

          <section className="grid g-top">
            <article className="card cam-card" ref={camCard}>
              <div className="card-h"><Camera /><h2>Live Camera Feed</h2>
                <span className="tag">Frame · {hms(now)}</span>
                <button className="ghost" onClick={() => setPaused(p => !p)}>{paused ? <Play /> : <Pause />}<span>{paused ? 'Resume' : 'Pause'}</span></button>
                <button className="ghost" onClick={fullscreen}><Maximize /><span>Full screen</span></button>
              </div>
              <div className="cam-wrap">
                <div className={'cam' + (view === 'original' ? ' original' : '') + (paused || rear ? ' paused' : '')}>
                  <img src="/assets/camera.jpg" alt="Front camera view of a rocky forest trail" />
                  <svg className={'seg-layer' + (seg ? '' : ' off')} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points="7,100 88,100 61,70 55,58 52,52 47,52 44,58 36,72 22,88" fill="rgba(34,197,94,.38)" stroke="rgba(74,222,128,.9)" strokeWidth=".25" vectorEffect="non-scaling-stroke" />
                    <polygon points="88,100 100,100 100,86 80,76 70,70 61,70" fill="rgba(250,204,21,.28)" />
                    <path d="M50 100 C49 86 52 76 50 62 C49 56 50 53 50 52" fill="none" stroke="#22d3ee" strokeWidth="1" strokeDasharray="2 1.4" vectorEffect="non-scaling-stroke" />
                  </svg>
                  {!rear && (
                    <div id="boxes" className={(!boxes || view === 'original' ? 'off ' : '') + (labels ? '' : 'nolabels')}>
                      {v.map(d => (
                        <div key={d.id} className={`box ${d.lvl}`} style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${d.h}%` }}>
                          <span>{d.label} — {Math.round(d.conf * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="hud"><span>Camera: {rear ? 'Rear' : 'Front'}</span><span>Model: YOLO (sim)</span><span>Processing: {Math.round(lat)} ms</span><span>Mean conf: {mean.toFixed(2)}</span></div>
                  <div className="paused-msg">{rear ? 'Rear camera not connected' : 'Feed paused'}</div>
                </div>
                <div className="cam-side">
                  <ul className="legend">
                    {[['#22c55e', 'Traversable path'], ['#facc15', 'Risky terrain'], ['#ef4444', 'Obstacle'], ['#64748b', 'Unknown region']].map(([c, t]) => <li key={t}><i style={{ background: c }} />{t}</li>)}
                    <li><i className="ln" />Planned route</li>
                  </ul>
                  <div className="compass"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="#1f3a5c" strokeWidth="2" /><text x="40" y="14" textAnchor="middle" fill="#9fb4d0" fontSize="9">N</text><path d="M40 20 L48 52 L40 46 L32 52Z" fill="#22d3ee" /></svg></div>
                </div>
              </div>
              <div className="controls">
                <Switch label="Bounding boxes" checked={boxes} onChange={setBoxes} />
                <Switch label="Labels" checked={labels} onChange={setLabels} />
                <Switch label="Segmentation" checked={seg} onChange={setSeg} />
                <label className="range">Min confidence
                  <input type="range" min="0.5" max="0.95" step="0.01" value={thr} onChange={e => setThr(+e.target.value)} />
                  <b>{thr.toFixed(2)}</b>
                </label>
                <div className="filters" role="group" aria-label="Filter object categories">
                  {ALL_CATS.map(c => <button key={c} className={cats.has(c) ? 'on' : ''} aria-pressed={cats.has(c)} onClick={() => toggleCat(c)}>{c}</button>)}
                </div>
                <button className="ghost" onClick={reset}><RotateCcw /><span>Reset</span></button>
              </div>
              <div className="seg-panel">
                <h3>Terrain Segmentation <span className="muted">visible area, sample</span></h3>
                {TERRAIN.map(([n, p, c]) => (
                  <div className="bar-row" key={n} style={{ ['--c' as string]: c }}><span>{n}</span><div className="tr"><i style={{ width: `${p}%` }} /></div><b>{p}%</b></div>
                ))}
                <p className="note"><TriangleAlert />Recognizing a terrain class is not the same as proving it can be driven on. Grass can hide ditches or soft ground.</p>
              </div>
            </article>

            <article className="card out-card">
              <div className="card-h"><BrainCircuit /><h2>AI Model Outputs</h2></div>
              <div className="tabs">
                {TABS.map(([k, name]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{name.replace(' Risk', '')}</button>)}
              </div>
              <div className="outs">
                {TABS.map(([k, name, img, desc, conf]) => (
                  <figure key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                    <img src={`/assets/${img}`} alt={`${name} output`} />
                    <figcaption><b>{name}</b><span>{desc}</span><em>{conf}</em></figcaption>
                  </figure>
                ))}
              </div>
            </article>
          </section>

          <section className="grid g-mid">
            <article className="card">
              <div className="card-h"><GaugeIcon /><h2>Perception Metrics</h2></div>
              <div className="gauges">
                <Gauge label="Path" value={s.cp[N - 1]} color="#22c55e" />
                <Gauge label="Detection" value={s.cd[N - 1]} color="#3b82f6" />
                <Gauge label="Depth" value={0.78} color="#8b5cf6" />
                <Gauge label="Terrain" value={s.ct[N - 1]} color="#fb923c" />
              </div>
              <div className="card-h sub"><Boxes /><h2>Detected Objects</h2><span className="tag">{v.length} in frame</span></div>
              <div className="counts">
                {counts.map(([n, c, col, Icon]) => <div key={n} className={`count c-${col}`}><span className="ic"><Icon /></span><div><small>{n}</small><b>{c}</b></div></div>)}
              </div>
            </article>

            <article className="card">
              <div className="card-h"><Sparkles /><h2>Perception-Based Navigation Insights</h2></div>
              <div className={`decision c-${dc}`}>
                <div className="big">{dk}</div>
                <div><p><b>Reason:</b> {dwhy}</p><small>Simulated recommendation. It is not sent to the robot. Final decisions come from the planner and safety layer.</small></div>
              </div>
              {insights.map(([t, st, c, Icon, p]) => (
                <div key={t} className={`insight c-${c}`}><span className="ic"><Icon /></span><div><b>{t}</b><span className="st">{st}</span><p>{p}</p></div></div>
              ))}
            </article>

            <article className="card">
              <div className="card-h"><ScanSearch /><h2>Recent Detections</h2><span className="tag">sample</span></div>
              <ul className="recent">
                {DETECTIONS.filter(d => d.cls !== 'Unknown').slice(0, 4).map((d, i) => {
                  const w = 4600 / d.w, h = w / 1.5;
                  return (
                    <li key={d.id} className={`c-${d.lvl}`}>
                      <div className="th" style={{ backgroundImage: 'url(/assets/camera.jpg)', backgroundSize: `${w}px ${h}px`, backgroundPosition: `-${(d.x * w) / 100}px -${(d.y * h) / 100}px` }} />
                      <div><b>{d.label}</b><span>Confidence: {d.conf.toFixed(2)}</span><span>Est. distance: ~{d.d.toFixed(1)} m</span></div>
                      <time>{hms(new Date(now.getTime() - (i * 37 + 20) * 1000))}</time>
                    </li>
                  );
                })}
              </ul>
            </article>
          </section>

          <section className="grid g-haz">
            <article className="card">
              <div className="card-h"><OctagonAlert /><h2>Obstacle &amp; Hazard Analysis</h2></div>
              <div className="kpis">
                {kpis.map(([t, n, c]) => <div key={t} className={`kpi c-${c}`}><small>{t}</small><b style={{ color: 'var(--c)' }}>{n}</b></div>)}
              </div>
              <div className="haz-list">
                {sorted.length === 0 && <p className="note">No detections above the current confidence threshold.</p>}
                {sorted.map(d => (
                  <div key={d.id} className={`haz c-${d.lvl}`}>
                    <h4>Hazard {d.id}<em>{LEVELS[d.lvl][0]}</em></h4>
                    <span>Category: <b>{d.cls}</b></span><span>Detection confidence: <b>{Math.round(d.conf * 100)}%</b></span>
                    <span>Route impact: <b>{d.impact}</b></span><span>Est. distance: <b>~{d.d.toFixed(1)} m (uncalibrated)</b></span>
                    <div className="act">Suggested action: {d.act}</div>
                  </div>
                ))}
              </div>
            </article>

            <article className="card">
              <div className="card-h"><RadarIcon /><h2>Spatial Awareness</h2><span className="tag warn">Monocular estimate</span></div>
              <RadarView items={v} />
              <p className="note"><Ruler />Distances are depth-model estimates from one RGB camera. Metric scale is not calibrated, so treat them as approximate. A stereo or depth camera is needed for reliable ranging.</p>
            </article>

            <article className="card">
              <div className="card-h"><ListChecks /><h2>Recent Perception Events</h2></div>
              <ul className="events">
                {events.map((e, k) => (
                  <li key={k} style={{ ['--c' as string]: SEV[EVENTS[e.i][1]] }}>
                    <i className="sv" /><div><b>{EVENTS[e.i][0]}</b><span>{EVENTS[e.i][2]}</span></div><time>{hms(e.t)}</time>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="card perf">
            <div className="card-h"><Activity /><h2>AI Model Performance</h2><span className="tag">simulated telemetry</span></div>
            <div className="perf-grid">
              <div><h3>Inference time (ms)</h3><Chart lines={[{ data: s.lat, color: '#22c55e' }]} min={0} max={100} /></div>
              <div><h3>Confidence over time <span className="lg"><i style={{ background: '#22c55e' }} />Path <i style={{ background: '#3b82f6' }} />Detection <i style={{ background: '#fb923c' }} />Terrain</span></h3>
                <Chart lines={[{ data: s.cp, color: '#22c55e' }, { data: s.cd, color: '#3b82f6' }, { data: s.ct, color: '#fb923c' }]} min={0} max={1} /></div>
              <div><h3>Processing FPS</h3><Chart bars lines={[{ data: s.fp, color: '#2dd4bf' }]} min={0} max={60} /></div>
              <div className="models">
                <div className="mrow"><span>Detection model</span><b>YOLO · sample output</b></div>
                <div className="mrow"><span>Segmentation model</span><b>SegFormer · sample output</b></div>
                <div className="mrow"><span>Inference status</span><span className="st-pill c-yellow">Simulated</span></div>
                <div className="mrow"><span>Latency</span><b>{Math.round(lat)} ms</b></div>
                <div className="mrow"><span>Frames / second</span><b>{fps} (simulated)</b></div>
                <div className="mrow"><span>Detections in frame</span><b>{v.length}</b></div>
                <div className="mrow"><span>Backend (WebSocket)</span><span className="st-pill c-gray">Model unavailable</span></div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

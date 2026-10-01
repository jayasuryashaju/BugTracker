import { useId, useRef, useState } from 'react';

/** Part-to-whole as one stacked bar. Segments are separated by a 2px surface gap. */
export const StackBar = ({ segments }) => {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div>
      <div className="stackbar" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        {total > 0 && segments.filter((s) => s.value > 0).map((s) => (
          <span key={s.label} style={{ flexGrow: s.value, background: s.color }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div className="chart-legend" style={{ marginTop: 14 }}>
        {segments.map((s) => (
          <span key={s.label}><i style={{ background: s.color }} />{s.label} <b style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</b></span>
        ))}
      </div>
    </div>
  );
};

/** Ordinal magnitude as horizontal bars on a one-hue ramp, anchored to the baseline. */
export const HBars = ({ rows }) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div role="list">
      {rows.map((r) => (
        <div className="hbar" role="listitem" key={r.label} title={`${r.label}: ${r.value}`}>
          <span style={{ color: 'var(--text-2)' }}>{r.label}</span>
          <div className="hbar__track"><div className="hbar__fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} /></div>
          <span className="hbar__n">{r.value}</span>
        </div>
      ))}
    </div>
  );
};

const niceMax = (n) => {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / pow) * pow;
};

/** Two-series line chart with crosshair + tooltip and a table fallback. */
export const LineChart = ({ data, series, height = 220 }) => {
  const id = useId();
  const wrap = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 720;
  const pad = { l: 34, r: 12, t: 12, b: 26 };
  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => d[s.key]))));
  const x = (i) => pad.l + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  const ticks = [0, 1, 2, 3, 4].map((i) => Math.round((max / 4) * i));
  const step = Math.ceil(data.length / 7);

  const move = (clientX) => {
    const rect = wrap.current.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setHover((h) => Math.min(data.length - 1, (h ?? -1) + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setHover((h) => Math.max(0, (h ?? data.length) - 1)); }
    if (e.key === 'Escape') setHover(null);
  };

  const path = (key) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  const area = (key) => `${path(key)} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const point = hover != null ? data[hover] : null;

  return (
    <div>
      <div className="chart-legend" style={{ marginBottom: 10 }}>
        {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
      </div>
      <div className="linechart" ref={wrap}>
        <svg
          viewBox={`0 0 ${W} ${height}`}
          role="img"
          tabIndex={0}
          aria-label={`${series.map((s) => s.label).join(' and ')} per day. Use arrow keys to inspect days.`}
          onMouseMove={(e) => move(e.clientX)}
          onMouseLeave={() => setHover(null)}
          onTouchMove={(e) => move(e.touches[0].clientX)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={series[0].color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={series[0].color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-3)">{t}</text>
            </g>
          ))}
          {data.map((d, i) => (i % step === 0 || i === data.length - 1) && (
            <text key={d.date} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--text-3)">{d.name}</text>
          ))}
          <path d={area(series[0].key)} fill={`url(#${id}-fill)`} />
          {series.map((s) => (
            <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {point && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="var(--border-strong)" strokeWidth="1" />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(point[s.key])} r="4.5" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
        {point && (
          <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(Math.min(...series.map((s) => y(point[s.key]))) / height) * 100}%`, marginTop: -10 }}>
            <b>{point.name}</b>
            {series.map((s) => <div key={s.key}><i style={{ background: s.color }} />{s.label}: <b style={{ display: 'inline' }}>{point[s.key]}</b></div>)}
          </div>
        )}
      </div>
      <details className="data-table">
        <summary>View as table</summary>
        <table>
          <thead><tr><th>Day</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
          <tbody>{data.map((d) => <tr key={d.date}><td>{d.name}</td>{series.map((s) => <td key={s.key}>{d[s.key]}</td>)}</tr>)}</tbody>
        </table>
      </details>
    </div>
  );
};

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import type { Point } from './summary';

const HEIGHT = 36;
const WIDTH = 200; // viewBox units; the SVG stretches to its container

const useStyles = makeStyles(theme => ({
  root: {
    position: 'relative',
    height: HEIGHT,
    cursor: 'crosshair',
    outline: 'none',
    touchAction: 'none',
    '&:focus-visible': {
      boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
      borderRadius: 2,
    },
  },
  svg: { display: 'block', width: '100%', height: HEIGHT, overflow: 'visible' },
  line: {
    fill: 'none',
    // De-emphasis hue for the trend; the current point carries the accent.
    stroke: theme.palette.text.secondary,
    strokeOpacity: 0.55,
    strokeWidth: 1.5,
    strokeLinejoin: 'round',
    strokeLinecap: 'round',
    vectorEffect: 'non-scaling-stroke',
  },
  baseline: {
    stroke: theme.palette.divider,
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
  },
  // Dots and the hairline are HTML so they stay round/crisp while the SVG
  // stretches horizontally.
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    marginLeft: -4,
    marginTop: -4,
    borderRadius: '50%',
    background: theme.palette.primary.main,
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    pointerEvents: 'none',
  },
  hairline: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    background: theme.palette.text.secondary,
    opacity: 0.5,
    pointerEvents: 'none',
  },
  tooltip: {
    position: 'absolute',
    bottom: HEIGHT + 6,
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.borderRadius,
    background: theme.palette.background.paper,
    color: theme.palette.text.primary,
    boxShadow: theme.shadows[3],
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 1,
  },
  tooltipTime: { color: theme.palette.text.secondary, marginRight: theme.spacing(0.75) },
  empty: {
    height: HEIGHT,
    display: 'flex',
    alignItems: 'center',
    color: theme.palette.text.disabled,
    fontSize: '0.7rem',
  },
}));

// Centre the tooltip on the point, but keep it inside the card at the edges.
const tooltipShift = (x: number) => {
  if (x < 0.2) return '0';
  if (x > 0.8) return '-100%';
  return '-50%';
};

const timeOf = (t: number) =>
  new Date(t * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// A 30-minute trend under a stat tile: one thin line anchored to a zero
// baseline, the latest point marked in the accent colour, and a crosshair
// tooltip (pointer, or arrow keys — it's a slider for assistive tech)
// reading out any point. Gaps in the data
// (no traffic, a missed scrape) stay gaps rather than being bridged.
export const Sparkline = ({
  label,
  points,
  stepSeconds,
  rangeSeconds,
  end,
  format,
  accent,
}: {
  label: string;
  points: Point[];
  stepSeconds: number;
  rangeSeconds: number;
  // Right edge of the x axis (unix seconds), so position reads as recency.
  end: number;
  format: (value: number) => string;
  // Colour of the latest-point dot; the tile's status colour when abnormal.
  accent?: string;
}) => {
  const classes = useStyles();
  const [active, setActive] = useState<number | null>(null);

  const geometry = useMemo(() => {
    const start = end - rangeSeconds;
    const max = Math.max(0, ...points.map(([, v]) => v));
    const yMax = max > 0 ? max * 1.15 : 1;
    const x = (t: number) => Math.min(1, Math.max(0, (t - start) / rangeSeconds));
    const y = (v: number) => 1 - v / yMax;
    let d = '';
    points.forEach(([t, v], i) => {
      const gap = i === 0 || t - points[i - 1][0] > stepSeconds * 1.5;
      d += `${gap ? 'M' : 'L'}${(x(t) * WIDTH).toFixed(2)},${(y(v) * HEIGHT).toFixed(2)}`;
    });
    return { d, x, y };
  }, [points, stepSeconds, rangeSeconds, end]);

  if (points.length === 0) {
    return <div className={classes.empty}>No data in the last {Math.round(rangeSeconds / 60)} min</div>;
  }

  const values = points.map(([, v]) => v);
  const summary = `${label}, last ${Math.round(rangeSeconds / 60)} minutes: min ${format(
    Math.min(...values),
  )}, max ${format(Math.max(...values))}, latest ${format(values[values.length - 1])}`;

  const nearest = (clientX: number, rect: DOMRect) => {
    const t = end - rangeSeconds + ((clientX - rect.left) / rect.width) * rangeSeconds;
    let best = 0;
    points.forEach(([pt], i) => {
      if (Math.abs(pt - t) < Math.abs(points[best][0] - t)) best = i;
    });
    return best;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) =>
    setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = active ?? points.length - 1;
    if (e.key === 'ArrowLeft') setActive(Math.max(0, current - 1));
    else if (e.key === 'ArrowRight') setActive(Math.min(points.length - 1, current + 1));
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };

  const last = points[points.length - 1];
  const shown = active === null ? null : points[active];
  const focusIndex = active ?? points.length - 1;
  const pct = (p: Point) => ({
    left: `${geometry.x(p[0]) * 100}%`,
    top: geometry.y(p[1]) * HEIGHT,
  });

  return (
    <div
      className={classes.root}
      role="slider"
      aria-label={summary}
      aria-valuemin={0}
      aria-valuemax={points.length - 1}
      aria-valuenow={focusIndex}
      aria-valuetext={`${timeOf(points[focusIndex][0])}, ${format(points[focusIndex][1])}`}
      tabIndex={0}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setActive(null)}
      onFocus={() => setActive(points.length - 1)}
      onBlur={() => setActive(null)}
      onKeyDown={onKeyDown}
    >
      <svg className={classes.svg} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden>
        <line className={classes.baseline} x1={0} x2={WIDTH} y1={HEIGHT} y2={HEIGHT} />
        <path className={classes.line} d={geometry.d} />
      </svg>
      {shown ? (
        <>
          <div className={classes.hairline} style={{ left: pct(shown).left }} />
          <div className={classes.dot} style={pct(shown)} />
          <div
            className={classes.tooltip}
            style={{ left: pct(shown).left, transform: `translateX(${tooltipShift(geometry.x(shown[0]))})` }}
            role="status"
          >
            <span className={classes.tooltipTime}>{timeOf(shown[0])}</span>
            {format(shown[1])}
          </div>
        </>
      ) : (
        <div className={classes.dot} style={{ ...pct(last), ...(accent ? { background: accent } : {}) }} />
      )}
    </div>
  );
};

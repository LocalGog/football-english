import { useState } from 'react';

export interface Bar {
  key: string;
  /** Short axis label, e.g. weekday. */
  label: string;
  /** Full label for the readout, e.g. "Пн, 12.11". */
  title: string;
  value: number;
}

interface Props {
  bars: Bar[];
  unit: string;
  /** Optional reference line, e.g. the daily goal. */
  goal?: number;
  goalLabel?: string;
  /** Axis labels are shown for every n-th bar (1 = all). */
  labelEvery?: number;
  ariaLabel: string;
}

const H = 120;
const AXIS = 18;
const GAP = 2;

/**
 * Single-series column chart. One hue, rounded data-ends on the baseline, recessive grid.
 * Tap or hover a column to read its value; the same numbers are in the hidden table for screen readers.
 */
export function BarChart({ bars, unit, goal, goalLabel, labelEvery = 1, ariaLabel }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, goal ?? 0, ...bars.map((b) => b.value));
  const step = 100 / bars.length;
  const y = (v: number) => H - (v / max) * (H - 8);
  const shown = active === null ? null : bars[active];

  return (
    <figure className="flex flex-col gap-1">
      <p className="h-5 text-sm text-mute" aria-live="polite">
        {shown ? (
          <>
            <b className="text-chalk tabular-nums">
              {shown.value} {unit}
            </b>{' '}
            · {shown.title}
          </>
        ) : (
          'Торкнися стовпчика, щоб побачити число'
        )}
      </p>
      <div className="relative" style={{ height: H + AXIS }}>
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 100 ${H + AXIS}`} preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" x2="100" y1={H} y2={H} stroke="var(--color-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {goal !== undefined && goal > 0 && (
            <line x1="0" x2="100" y1={y(goal)} y2={y(goal)} stroke="var(--color-mute)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {goal !== undefined && goal > 0 && (
          <span className="absolute right-0 -translate-y-full pb-0.5 text-[11px] text-mute" style={{ top: y(goal) }}>
            {goalLabel}
          </span>
        )}
        <div className="absolute inset-x-0 top-0 flex" style={{ height: H }}>
          {bars.map((b, i) => {
            const h = b.value > 0 ? Math.max(3, (b.value / max) * (H - 8)) : 0;
            return (
              <button
                key={b.key}
                className="relative h-full outline-offset-0"
                style={{ width: `${step}%`, paddingInline: GAP / 2 }}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                aria-label={`${b.title}: ${b.value} ${unit}`}
                data-bar={b.key}
              >
                <span
                  className={`absolute inset-x-[1px] bottom-0 rounded-t-[4px] transition-colors ${active === i ? 'bg-[#35c07a]' : 'bg-pitch'}`}
                  style={{ height: h }}
                />
              </button>
            );
          })}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex" style={{ height: AXIS }} aria-hidden="true">
          {bars.map((b, i) => (
            <span key={b.key} className="truncate pt-1 text-center text-[11px] text-mute" style={{ width: `${step}%` }}>
              {i % labelEvery === 0 || i === bars.length - 1 ? b.label : ''}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <th>{b.title}</th>
              <td>
                {b.value} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

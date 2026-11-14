import type { Bar } from '../components/BarChart';
import { lastDays, minutesOf } from './stats';
import type { DayStat, Progress } from './types';

const WEEKDAYS = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/** Columns for the last `n` days of one daily measure. */
export function dailyBars(p: Progress, n: number, now: number, pick: (d: DayStat) => number): Bar[] {
  return lastDays(n, now).map((key) => {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const weekday = WEEKDAYS[date.getDay()];
    const day = p.history[key];
    return {
      key,
      label: n <= 7 ? weekday : String(d),
      title: `${weekday}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}`,
      value: day ? pick(day) : 0,
    };
  });
}

export const minutesPick = (d: DayStat): number => minutesOf(d.seconds);
export const learnedPick = (d: DayStat): number => d.learned;

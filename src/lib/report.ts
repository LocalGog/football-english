import { levelInfo } from './progress';
import { learnedCount } from './srs';
import { hardWords, isMastered, lastDays, periodSummary, topics } from './stats';
import type { Content, Progress } from './types';

const REPORT_DAYS = 7;
const MAX_HARD = 5;

const pct = (x: number | null): string => (x === null ? '—' : `${Math.round(x * 100)}%`);
const shortDate = (key: string): string => {
  const [, m, d] = key.split('-');
  return `${d}.${m}`;
};

/**
 * Plain-text weekly report for a messenger. Only numbers the parent zone also shows,
 * so the child sends nothing the parent could not see on the phone itself.
 */
export function weeklyReport(content: Content, p: Progress, now: number): string {
  const days = lastDays(REPORT_DAYS, now);
  const week = periodSummary(p, REPORT_DAYS, now);
  const hard = hardWords(content, p).slice(0, MAX_HARD);
  const allTopics = topics(content, p);
  const mastered = allTopics.filter(isMastered).length;
  const word = (id: string) => {
    const w = content.wordById.get(id);
    return w ? `${w.english} (${w.ukrainian})` : id;
  };

  const lines = [
    `⚽ Football English — звіт за тиждень ${shortDate(days[0])}–${shortDate(days[days.length - 1])}`,
    `Гравець: ${p.player?.name ?? '—'} · рівень ${levelInfo(p.xp).level}`,
    `Час: ${week.minutes} хв, занять ${week.activeDays} з ${REPORT_DAYS} днів (ціль ${p.parent.dailyMinutes} хв на день)`,
    `Нові слова: ${week.learned} (усього вивчено ${learnedCount(p)} з ${content.words.length})`,
    `Матчів: ${week.matches} · правильних відповідей ${pct(week.accuracy)} · на слух ${pct(week.listenAccuracy)}`,
    `Складні слова: ${hard.length ? hard.map((h) => word(h.id)).join(', ') : 'немає'}`,
    `Засвоєні теми: ${mastered} з ${allTopics.length}`,
  ];
  if (week.activeDays === 0) lines.push('Цього тижня занять не було.');
  return lines.join('\n');
}

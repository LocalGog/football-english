import { describe, expect, it } from 'vitest';
import { content } from '../src/lib/content';
import { newProgress, recordAnswer, recordMatch } from '../src/lib/progress';
import { weeklyReport } from '../src/lib/report';
import type { Progress } from '../src/lib/types';

const at = (day: number, hour = 12) => new Date(2026, 10, day, hour).getTime();
const player = (): Progress => ({ ...newProgress(), player: { name: 'Макс', avatar: 'gold' } });

describe('weekly report', () => {
  it('summarises the last 7 days in plain text', () => {
    let p = recordMatch(player(), { missionId: 'm01', correct: 12, total: 14, goal: true, xp: 200, seconds: 360, missed: [] }, at(14), true);
    p = recordMatch(p, { missionId: 'm02', correct: 14, total: 14, goal: true, xp: 200, seconds: 300, missed: [] }, at(10), true);
    p = recordAnswer(recordAnswer(p, 'ball', true, at(14), 'listen'), 'ball', true, at(14), 'listen');
    p = recordAnswer(recordAnswer(p, 'goal', false, at(14), 'listen', 'ball'), 'goal', false, at(14), 'read', 'team');
    p = recordMatch(p, { missionId: 'm03', correct: 1, total: 1, goal: false, xp: 10, seconds: 600, missed: [] }, at(1), true); // older than a week
    const text = weeklyReport(content, p, at(15, 9));
    expect(text.split('\n')).toEqual([
      '⚽ Football English — звіт за тиждень 09.11–15.11',
      'Гравець: Макс · рівень 3',
      'Час: 11 хв, занять 2 з 7 днів (ціль 10 хв на день)',
      'Нові слова: 1 (усього вивчено 1 з 202)',
      'Матчів: 2 · правильних відповідей 50% · на слух 67%',
      'Складні слова: goal (гол)',
      'Засвоєні теми: 0 з 30',
    ]);
  });
  it('says so when there was no practice this week', () => {
    const text = weeklyReport(content, player(), at(15));
    expect(text).toContain('Час: 0 хв, занять 0 з 7 днів');
    expect(text).toContain('Складні слова: немає');
    expect(text.endsWith('Цього тижня занять не було.')).toBe(true);
  });
});

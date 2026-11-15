import { useState } from 'react';
import { Check, Volume2 } from 'lucide-react';
import { BarChart } from '../components/BarChart';
import { ShareReport } from '../components/ShareReport';
import { WordImage } from '../components/WordImage';
import { dailyBars, learnedPick } from '../lib/charts';
import { speak } from '../lib/speech';
import { LEARNED_MASTERY, learnedCount } from '../lib/srs';
import { isMastered, periodSummary, topics } from '../lib/stats';
import type { Content, Progress } from '../lib/types';

type Filter = 'learned' | 'learning';

/** The child's own view: what I know, how my week went, my dictionary. */
export function ProgressTab({ content, progress, now }: { content: Content; progress: Progress; now: number }) {
  const [filter, setFilter] = useState<Filter>('learned');
  const week = periodSummary(progress, 7, now);
  const list = topics(content, progress).filter((t) => t.seen > 0);
  const words = content.words.filter((w) => {
    const s = progress.words[w.id];
    if (!s) return false;
    return filter === 'learned' ? s.mastery >= LEARNED_MASTERY : s.mastery < LEARNED_MASTERY;
  });
  const learned = learnedCount(progress);
  const seen = Object.keys(progress.words).filter((id) => content.wordById.has(id)).length;
  const pill = (active: boolean) => `h-10 flex-1 rounded-xl border-2 text-sm font-semibold ${active ? 'border-gold bg-gold/15 text-chalk' : 'border-line text-mute'}`;

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
      <header>
        <h1 className="display text-3xl">Progress</h1>
        <p className="text-sm text-mute">
          Вивчено {learned} з {content.words.length} слів · у процесі {seen - learned}
        </p>
      </header>

      <section className="rounded-3xl border border-line bg-panel p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="display text-xl">Мій тиждень</h2>
          <p className="text-sm text-mute">
            нових слів: <b className="tabular-nums text-chalk">{week.learned}</b> · матчів: <b className="tabular-nums text-chalk">{week.matches}</b>
          </p>
        </div>
        <BarChart
          bars={dailyBars(progress, 7, now, learnedPick)}
          unit="сл."
          ariaLabel="Нові вивчені слова за останні 7 днів"
        />
        <p className="mt-1 text-xs text-mute">Нові вивчені слова за день</p>
        <div className="mt-3">
          <ShareReport content={content} progress={progress} now={now} />
        </div>
      </section>

      <section>
        <h2 className="display mb-2 text-xl">Теми</h2>
        {list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-3 text-sm text-mute">Теми з'являться після першого матчу.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((t) => (
              <li key={t.id} className="rounded-2xl border border-line bg-panel px-3 py-2" data-topic={t.id}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">{t.title}</span>
                  {isMastered(t) && <Check size={18} className="text-pitch" aria-label="Тему засвоєно" />}
                  <span className="text-sm tabular-nums text-mute">
                    {t.learned}/{t.total}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-night">
                  <div className="h-full rounded-full bg-pitch" style={{ width: `${(t.learned / t.total) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="display mb-2 text-xl">Мій словник</h2>
        <div className="mb-2 flex gap-2">
          <button className={pill(filter === 'learned')} onClick={() => setFilter('learned')} aria-pressed={filter === 'learned'}>
            Вивчені
          </button>
          <button className={pill(filter === 'learning')} onClick={() => setFilter('learning')} aria-pressed={filter === 'learning'}>
            Ще вчу
          </button>
        </div>
        {words.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-3 text-sm text-mute">
            {filter === 'learned' ? 'Слово вважається вивченим після двох правильних відповідей поспіль.' : 'Усі зустрінуті слова вже вивчені.'}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {words.map((w) => (
              <li key={w.id}>
                <button
                  className="flex w-full items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-2 text-left"
                  onClick={() => speak(w.english, progress.settings)}
                  aria-label={`Послухати ${w.english}`}
                >
                  <WordImage word={w} className="w-8 text-center text-2xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{w.english}</span>
                    <span className="block truncate text-sm text-mute">{w.ukrainian}</span>
                  </span>
                  <Volume2 size={16} className="shrink-0 text-mute" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

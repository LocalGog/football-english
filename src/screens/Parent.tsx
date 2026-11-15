import { useEffect, useState, type FormEvent } from 'react';
import { Lock, LogOut } from 'lucide-react';
import { BackupPanel } from '../components/BackupPanel';
import { BarChart } from '../components/BarChart';
import { ShareReport } from '../components/ShareReport';
import { dailyBars, minutesPick } from '../lib/charts';
import { checkPin, hashPin, isValidPin, makeSalt, PIN_LENGTH } from '../lib/pin';
import { DAILY_MINUTE_CHOICES, levelInfo } from '../lib/progress';
import { learnedCount } from '../lib/srs';
import { accuracyByMode, hardWords, isMastered, minutesOf, periodSummary, todayMinutes, topics, type Period } from '../lib/stats';
import type { Content, PickMode, Progress } from '../lib/types';

interface Props {
  content: Content;
  progress: Progress;
  now: number;
  unlocked: boolean;
  onUnlock: () => void;
  onLock: () => void;
  onSetPin: (hash: string, salt: string) => void;
  onResetPin: () => void;
  onDailyMinutes: (minutes: number) => void;
  onImport: (p: Progress) => void;
  onReset: () => void;
}

const pct = (x: number | null): string => (x === null ? '—' : `${Math.round(x * 100)}%`);
const MODE_LABEL: Record<PickMode, string> = { read: 'Читання слова', listen: 'Слухання', name: 'Згадати англійською' };
const RESET_WORD = 'СКИНУТИ';

export function ParentScreen(props: Props) {
  const { progress, unlocked } = props;
  if (!progress.parent.pinHash) return <PinSetup onSet={props.onSetPin} />;
  if (!unlocked) return <PinGate progress={progress} onUnlock={props.onUnlock} onResetPin={props.onResetPin} />;
  return <Dashboard {...props} />;
}

function PinInput({ id, value, onChange, label }: { id: string; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold uppercase tracking-widest text-mute">
        {label}
      </label>
      <input
        id={id}
        className="h-14 rounded-2xl border-2 border-line bg-panel px-4 text-center text-3xl tracking-[0.6em] text-chalk focus:border-gold focus:outline-none"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={PIN_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
      />
    </div>
  );
}

function PinSetup({ onSet }: { onSet: (hash: string, salt: string) => void }) {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidPin(pin)) return setError(`PIN має складатися з ${PIN_LENGTH} цифр.`);
    if (pin !== again) return setError('PIN-коди не збігаються.');
    const salt = makeSalt();
    onSet(await hashPin(pin, salt), salt);
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <h1 className="display text-3xl">Parent Zone</h1>
      <p className="text-mute">
        Розділ для батьків: статистика навчання, резервна копія, налаштування. PIN має створити дорослий. PIN і прогрес зберігаються лише на цьому телефоні, тому на кожному пристрої вони окремі.
      </p>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <PinInput id="pin-new" label="Новий PIN" value={pin} onChange={setPin} />
        <PinInput id="pin-again" label="Повторіть PIN" value={again} onChange={setAgain} />
        {error && (
          <p className="text-sm text-miss" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="display h-14 rounded-2xl bg-gold text-xl text-night">
          Створити PIN
        </button>
      </form>
    </main>
  );
}

function PinGate({ progress, onUnlock, onResetPin }: { progress: Progress; onUnlock: () => void; onResetPin: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [phrase, setPhrase] = useState('');
  const { pinHash, pinSalt } = progress.parent;

  // Checks as soon as all digits are in.
  useEffect(() => {
    if (pin.length !== PIN_LENGTH || !pinHash || !pinSalt) return;
    let alive = true;
    void checkPin(pin, pinSalt, pinHash).then((ok) => {
      if (!alive) return;
      if (ok) onUnlock();
      else {
        setError('Неправильний PIN.');
        setPin('');
      }
    });
    return () => {
      alive = false;
    };
  }, [pin, pinHash, pinSalt, onUnlock]);

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <h1 className="display flex items-center gap-2 text-3xl">
        <Lock size={26} /> Parent Zone
      </h1>
      <PinInput id="pin-enter" label="PIN батьків" value={pin} onChange={(v) => (setError(null), setPin(v))} />
      {error && (
        <p className="text-sm text-miss" role="alert">
          {error}
        </p>
      )}
      {!forgot ? (
        <button className="self-start text-sm text-mute underline" onClick={() => setForgot(true)}>
          Забули PIN?
        </button>
      ) : (
        <div className="rounded-2xl border border-line bg-panel p-3 text-sm">
          <p>
            Скидання PIN не змінює прогрес дитини. Дата скидання буде показана в розділі для батьків. Щоб скинути, введіть слово <b>{RESET_WORD}</b>.
          </p>
          <input
            id="pin-reset-phrase"
            className="mt-2 h-12 w-full rounded-xl border-2 border-line bg-night px-3 text-chalk focus:border-gold focus:outline-none"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            autoComplete="off"
          />
          <button
            className="mt-2 h-11 w-full rounded-xl bg-miss font-semibold text-night disabled:opacity-40"
            disabled={phrase.trim().toUpperCase() !== RESET_WORD}
            onClick={onResetPin}
          >
            Скинути PIN
          </button>
        </div>
      )}
    </main>
  );
}

function PeriodCard({ title, period }: { title: string; period: Period }) {
  const cells = [
    { label: 'Хвилин', value: String(period.minutes) },
    { label: 'Днів занять', value: `${period.activeDays}/${period.days}` },
    { label: 'Нових слів', value: String(period.learned) },
    { label: 'Матчів', value: String(period.matches) },
    { label: 'Правильних відповідей', value: pct(period.accuracy) },
    { label: 'На слух', value: pct(period.listenAccuracy) },
  ];
  return (
    <section className="rounded-3xl border border-line bg-panel p-4" data-period={period.days}>
      <h2 className="display text-xl">{title}</h2>
      <dl className="mt-2 grid grid-cols-3 gap-x-2 gap-y-3">
        {cells.map((c) => (
          <div key={c.label}>
            <dt className="text-[11px] leading-tight text-mute">{c.label}</dt>
            <dd className="display text-2xl tabular-nums">{c.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Dashboard({ content, progress, now, onLock, onDailyMinutes, onImport, onReset }: Props) {
  const [range, setRange] = useState<7 | 30>(7);
  const [confirmReset, setConfirmReset] = useState('');
  const week = periodSummary(progress, 7, now);
  const month = periodSummary(progress, 30, now);
  const goal = progress.parent.dailyMinutes;
  const allTopics = topics(content, progress);
  const mastered = allTopics.filter(isMastered);
  const inProgress = allTopics.filter((t) => t.seen > 0 && !isMastered(t));
  const hard = hardWords(content, progress);
  const modes = accuracyByMode(progress);
  const en = (id: string) => content.wordById.get(id)?.english ?? id;
  const uk = (id: string) => content.wordById.get(id)?.ukrainian ?? '';
  const pill = (active: boolean) => `h-11 flex-1 rounded-xl border-2 text-sm font-semibold ${active ? 'border-gold bg-gold/15 text-chalk' : 'border-line text-mute'}`;
  const doneMissions = content.missions.filter((m) => progress.missions[m.id]?.completed > 0).length;

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4" data-parent-dashboard>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="display text-3xl">Parent Zone</h1>
          <p className="truncate text-sm text-mute">
            {progress.player?.name} · рівень {levelInfo(progress.xp).level} · складність {progress.adaptive.tier + 1}/3
          </p>
        </div>
        <button className="flex h-11 shrink-0 items-center gap-1 rounded-xl border border-line px-3 text-sm text-mute" onClick={onLock}>
          <LogOut size={16} /> Вийти
        </button>
      </header>

      {progress.parent.pinResetAt && (
        <p className="rounded-2xl border border-gold/60 bg-gold/10 p-3 text-sm" role="note">
          PIN скидали {new Date(progress.parent.pinResetAt).toLocaleString('uk-UA')}.
        </p>
      )}

      <section className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Слів вивчено', value: `${learnedCount(progress)}/${content.words.length}` },
          { label: 'Матчів пройдено', value: `${doneMissions}/${content.missions.length}` },
          { label: 'Часу всього, хв', value: String(minutesOf(progress.stats.secondsPlayed)) },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-panel px-1 py-3">
            <p className="display text-2xl tabular-nums">{t.value}</p>
            <p className="text-[11px] text-mute">{t.label}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-line bg-panel p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="display text-xl">Час занять</h2>
          <p className="text-sm text-mute">
            сьогодні <b className="tabular-nums text-chalk">{todayMinutes(progress, now)}</b> / {goal} хв
          </p>
        </div>
        <div className="my-2 flex gap-2">
          <button className={pill(range === 7)} onClick={() => setRange(7)} aria-pressed={range === 7}>
            7 днів
          </button>
          <button className={pill(range === 30)} onClick={() => setRange(30)} aria-pressed={range === 30}>
            30 днів
          </button>
        </div>
        <BarChart
          bars={dailyBars(progress, range, now, minutesPick)}
          unit="хв"
          goal={goal}
          goalLabel={`ціль ${goal} хв`}
          labelEvery={range === 7 ? 1 : 5}
          ariaLabel={`Хвилини занять за останні ${range} днів`}
        />
      </section>

      <PeriodCard title="За тиждень" period={week} />
      <ShareReport content={content} progress={progress} now={now} />
      <PeriodCard title="За місяць" period={month} />

      <section className="rounded-3xl border border-line bg-panel p-4">
        <h2 className="display text-xl">Результати за типом завдань</h2>
        <p className="text-xs text-mute">Частка правильних відповідей за весь час</p>
        <ul className="mt-2 flex flex-col gap-2">
          {modes.map((m) => (
            <li key={m.mode} data-mode={m.mode}>
              <div className="flex justify-between text-sm">
                <span>{MODE_LABEL[m.mode]}</span>
                <span className="tabular-nums text-mute">
                  <b className="text-chalk">{pct(m.accuracy)}</b> · {m.answers} відп.
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-night">
                <div className="h-full rounded-full bg-pitch" style={{ width: `${(m.accuracy ?? 0) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-4">
        <h2 className="display text-xl">Складні слова</h2>
        {hard.length === 0 ? (
          <p className="mt-1 text-sm text-mute">Поки немає слів, у яких було дві й більше помилок.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-line/60">
            {hard.slice(0, 15).map((h) => (
              <li key={h.id} className="py-2 text-sm" data-hard-word={h.id}>
                <div className="flex justify-between gap-2">
                  <span>
                    <b>{en(h.id)}</b> <span className="text-mute">— {uk(h.id)}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-mute">
                    {h.wrong} пом. / {h.correct} прав.
                  </span>
                </div>
                <p className="text-xs text-mute">
                  Найважче: {MODE_LABEL[h.weakMode].toLowerCase()}
                  {h.confusedWith.length > 0 && ` · плутає з: ${h.confusedWith.map(en).join(', ')}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-panel p-4">
        <h2 className="display text-xl">Теми</h2>
        <p className="mt-1 text-sm">
          Засвоєно: <b>{mastered.length}</b> з {allTopics.length}
          <span className="text-mute"> (80% слів теми вивчено)</span>
        </p>
        {mastered.length > 0 && <p className="mt-1 text-sm text-pitch">{mastered.map((t) => t.title).join(', ')}</p>}
        {inProgress.length > 0 && (
          <p className="mt-1 text-sm text-mute">
            У процесі: {inProgress.map((t) => `${t.title} ${t.learned}/${t.total}`).join(', ')}
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-panel p-4">
        <h2 className="display text-xl">Рекомендований час на день</h2>
        <p className="mt-1 text-xs text-mute">Гра не блокується: після цілі дитина побачить пропозицію відпочити.</p>
        <div className="mt-2 flex gap-2">
          {DAILY_MINUTE_CHOICES.map((m) => (
            <button key={m} className={pill(goal === m)} onClick={() => onDailyMinutes(m)} aria-pressed={goal === m} data-daily={m}>
              {m} хв
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-4">
        <h2 className="display mb-2 text-xl">Резервна копія</h2>
        <BackupPanel progress={progress} onImport={onImport} />
        <p className="mt-2 text-xs text-mute">Файл копії переносить прогрес на інший телефон або браузер.</p>
      </section>

      <section className="rounded-3xl border border-miss/60 bg-panel p-4">
        <h2 className="display text-xl text-miss">Скинути прогрес</h2>
        <p className="mt-1 text-sm text-mute">
          Видаляє слова, матчі, клуб і статистику. PIN, ціль на день і налаштування звуку залишаться. Спершу збережіть копію. Щоб підтвердити, введіть <b className="text-chalk">{RESET_WORD}</b>.
        </p>
        <input
          id="reset-confirm"
          className="mt-2 h-12 w-full rounded-xl border-2 border-line bg-night px-3 text-chalk focus:border-miss focus:outline-none"
          value={confirmReset}
          onChange={(e) => setConfirmReset(e.target.value)}
          autoComplete="off"
        />
        <button
          className="mt-2 h-12 w-full rounded-xl bg-miss font-semibold text-night disabled:opacity-40"
          disabled={confirmReset.trim().toUpperCase() !== RESET_WORD}
          onClick={onReset}
          data-reset
        >
          Скинути весь прогрес
        </button>
      </section>
    </main>
  );
}

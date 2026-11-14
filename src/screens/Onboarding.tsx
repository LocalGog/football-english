import { useState, type FormEvent } from 'react';
import { Play } from 'lucide-react';
import { AVATARS, Avatar, DEFAULT_AVATAR } from '../components/Avatar';
import type { Player } from '../lib/types';

const MAX_NAME = 16;

export function Onboarding({ onDone }: { onDone: (player: Player) => void }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);
  const clean = name.trim().slice(0, MAX_NAME);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (clean) onDone({ name: clean, avatar });
  };

  return (
    <form className="mx-auto flex h-full max-w-md flex-col gap-6 overflow-y-auto p-5" onSubmit={submit}>
      <div className="pt-6 text-center">
        <p className="display text-5xl leading-none text-chalk">
          Football <span className="text-gold">English</span>
        </p>
        <p className="mt-3 text-mute">Грай у футбол. Англійська прийде сама.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="player-name" className="text-sm font-semibold uppercase tracking-widest text-mute">
          Як тебе звати на полі?
        </label>
        <input
          id="player-name"
          className="h-14 rounded-2xl border-2 border-line bg-panel px-4 text-xl font-semibold text-chalk placeholder:text-mute/60 focus:border-gold focus:outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME}
          placeholder="Ім'я або нік"
          autoComplete="off"
          enterKeyHint="done"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold uppercase tracking-widest text-mute">Обери форму</legend>
        <div className="grid grid-cols-3 gap-3">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`flex items-center justify-center rounded-2xl border-2 bg-panel py-3 transition ${avatar === a.id ? 'border-gold' : 'border-line'}`}
              onClick={() => setAvatar(a.id)}
              aria-pressed={avatar === a.id}
              aria-label={`Форма ${a.id}`}
            >
              <Avatar id={a.id} size={64} />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-auto flex flex-col gap-2 pb-2">
        <button
          type="submit"
          className="display flex h-18 items-center justify-center gap-3 rounded-2xl bg-gold py-5 text-2xl text-night disabled:bg-panel disabled:text-mute"
          disabled={!clean}
        >
          <Play size={26} fill="currentColor" /> Перший матч
        </button>
        {!clean && <p className="text-center text-sm text-mute">Впиши ім'я, щоб вийти на поле</p>}
      </div>
    </form>
  );
}

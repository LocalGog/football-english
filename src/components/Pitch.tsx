import type { BallSkin, Stadium } from '../lib/types';
import { Ball } from './Ball';

interface Props {
  progress: number;
  goal: boolean;
  ball: BallSkin;
  stadium: Stadium;
}

/** Mini pitch: the ball travels from our half to the goal as answers come in. */
export function Pitch({ progress, goal, ball, stadium }: Props) {
  const clamped = Math.min(1, Math.max(0, progress));
  const left = goal ? 95 : 5 + clamped * 80;
  return (
    <div
      className="relative h-12 overflow-hidden rounded-xl border-2 border-chalk/70"
      style={{ background: `repeating-linear-gradient(90deg, ${stadium.light} 0 12.5%, ${stadium.dark} 12.5% 25%)` }}
      role="progressbar"
      aria-label="Атака на ворота"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div className="absolute inset-y-0 left-1/2 w-0.5 bg-chalk/60" />
      <div className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-chalk/60" />
      <div className="absolute inset-y-2 right-0 w-5 rounded-l-sm border-2 border-r-0 border-chalk/80" />
      <div className="absolute inset-y-3 right-0 w-2 border-2 border-r-0 border-chalk bg-chalk/25" />
      <div
        className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 leading-none transition-[left] duration-500 ease-out ${goal ? 'anim-net' : ''}`}
        style={{ left: `${left}%` }}
      >
        <Ball skin={ball} size={26} />
      </div>
    </div>
  );
}

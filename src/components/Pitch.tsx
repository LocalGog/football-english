/** Mini pitch: the ball travels from our half to the goal as answers come in. */
export function Pitch({ progress, goal }: { progress: number; goal: boolean }) {
  const clamped = Math.min(1, Math.max(0, progress));
  const left = goal ? 95 : 5 + clamped * 80;
  return (
    <div
      className="pitch-stripes relative h-12 overflow-hidden rounded-xl border-2 border-chalk/70"
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
        className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl leading-none transition-[left] duration-500 ease-out ${goal ? 'anim-net' : ''}`}
        style={{ left: `${left}%` }}
        aria-hidden="true"
      >
        ⚽
      </div>
    </div>
  );
}

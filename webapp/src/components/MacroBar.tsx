import type { MacroProgress } from '../lib/macros';

export function MacroBar({ label, logged, target, pct }: { label: string } & MacroProgress) {
  return (
    <div className="macro">
      <div className="m-head">
        <span>{label}</span>
        <span><b>{logged}</b>{target != null ? ` / ${target}g` : 'g'}</span>
      </div>
      <div className="track">
        <div className="fill" style={{ width: `${pct}%` }} />
        {target != null && <div className="target" />}
      </div>
    </div>
  );
}

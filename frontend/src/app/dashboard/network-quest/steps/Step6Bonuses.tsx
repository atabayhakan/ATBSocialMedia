'use client';
import { BONUS_TYPES, CompensationPlan } from '../types';

interface Props {
  plan: CompensationPlan;
  onSet: (id: string, value: number) => void;
}

export function Step6Bonuses({ plan, onSet }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Bonuses</h2>
        <p className="text-sm text-muted-foreground">
          Planına ek gelir türleri ekle. Her bonus bir yüzde ile ifade edilir; 0 bırakmak o bonusu devre dışı bırakır.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card max-w-2xl divide-y divide-border">
        {BONUS_TYPES.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="font-medium">{b.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{b.desc}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={plan.bonuses[b.id] ?? 0}
                onChange={(e) => onSet(b.id, Number(e.target.value))}
                className="w-20 text-right font-mono bg-secondary border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <span className="font-mono text-muted-foreground">%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

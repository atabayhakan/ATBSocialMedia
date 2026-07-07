'use client';
import { Plus, X } from 'lucide-react';
import { CompensationPlan, Rank } from '../types';

interface Props {
  plan: CompensationPlan;
  onAdd: () => void;
  onSet: (idx: number, patch: Partial<Rank>) => void;
  onRemove: (idx: number) => void;
}

export function Step5Ranks({ plan, onAdd, onSet, onRemove }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Ranks</h2>
        <p className="text-sm text-muted-foreground">
          Rütbe basamaklarını tanımla. Her rütbe için kişisel hacim (PV), grup hacmi (GV), aktif kol sayısı ve ek bonus belirlenir.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden max-w-4xl">
        {plan.ranks.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">İsim</th>
                <th className="text-right p-3">PV</th>
                <th className="text-right p-3">GV</th>
                <th className="text-right p-3">Aktif Kol</th>
                <th className="text-right p-3">Bonus %</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {plan.ranks.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-2">
                    <input
                      type="text"
                      value={r.name}
                      onChange={(e) => onSet(i, { name: e.target.value })}
                      className="w-full bg-secondary border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <NumberInput value={r.personalVolume} onChange={(v) => onSet(i, { personalVolume: v })} />
                  </td>
                  <td className="p-2 text-right">
                    <NumberInput value={r.groupVolume} onChange={(v) => onSet(i, { groupVolume: v })} />
                  </td>
                  <td className="p-2 text-right">
                    <NumberInput value={r.activeLegs} min={0} max={10} onChange={(v) => onSet(i, { activeLegs: v })} />
                  </td>
                  <td className="p-2 text-right">
                    <NumberInput value={r.bonus} min={0} max={100} step={0.1} onChange={(v) => onSet(i, { bonus: v })} />
                  </td>
                  <td className="p-2 text-right">
                    <button
                      onClick={() => onRemove(i)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-secondary text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50"
                      title="Sil"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Henüz rütbe yok. Aşağıdaki butonla başla (örn: Bronze, Silver, Gold, Platinum).
          </div>
        )}
        <div className="p-3 border-t border-border bg-muted/20">
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-violet-500 hover:text-white hover:border-violet-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Rütbe Ekle
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberInput({
  value,
  min = 0,
  max = 1000000,
  step = 1,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-20 text-right font-mono bg-secondary border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500"
    />
  );
}

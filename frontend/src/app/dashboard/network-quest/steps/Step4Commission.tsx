'use client';
import { AlertTriangle } from 'lucide-react';
import { CompensationPlan } from '../types';

interface Props {
  plan: CompensationPlan;
  onSet: (idx: number, value: number) => void;
}

export function Step4Commission({ plan, onSet }: Props) {
  const total = plan.commission.reduce((a, b) => a + b, 0);
  const over = total > 100;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Commission</h2>
        <p className="text-sm text-muted-foreground">
          Her seviye için komisyon yüzdesi. Toplam %100'ü aşamaz. Seviye 1 (doğrudan alt) en yüksek olur.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden max-w-2xl">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Seviye</th>
              <th className="text-right p-3">Komisyon (%)</th>
              <th className="text-left p-3 w-2/5">Görsel</th>
            </tr>
          </thead>
          <tbody>
            {plan.commission.map((v, i) => (
              <tr key={i} className="border-t border-border">
                <td className="p-3 font-mono text-violet-300">L{i + 1}</td>
                <td className="p-3 text-right">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={v}
                    onChange={(e) => onSet(i, Number(e.target.value))}
                    className="w-20 text-right font-mono bg-secondary border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </td>
                <td className="p-3">
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all"
                      style={{ width: `${Math.min(100, v * 5)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-border bg-muted/30">
            <tr>
              <td className="p-3 font-mono text-muted-foreground">Toplam</td>
              <td className={`p-3 text-right font-mono font-semibold ${over ? 'text-rose-400' : 'text-violet-400'}`}>
                {total.toFixed(1)}%
              </td>
              <td className="p-3" />
            </tr>
          </tfoot>
        </table>
        {over && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border-t border-rose-500/30 text-rose-300 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Toplam komisyon %100'ü aşıyor — bu plan sürdürülebilir değil.
          </div>
        )}
      </div>
    </div>
  );
}

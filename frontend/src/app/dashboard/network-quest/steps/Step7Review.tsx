'use client';
import { Trophy, DollarSign, Layers, Percent, Users, Award } from 'lucide-react';
import { CompensationPlan, PLAN_METHODS } from '../types';

interface Props {
  plan: CompensationPlan;
}

export function Step7Review({ plan }: Props) {
  const total = plan.commission.reduce((a, b) => a + b, 0);
  const bonusTotal = Object.values(plan.bonuses).reduce((a, b) => a + b, 0);
  const method = PLAN_METHODS.find((m) => m.id === plan.method);

  const kpis = [
    { icon: Layers, label: 'Tip', value: method?.name || '—' },
    { icon: Trophy, label: 'Width × Depth', value: `${plan.width} × ${plan.depthUnlimited ? '∞' : plan.depth}` },
    { icon: Percent, label: 'Toplam Komisyon', value: `${total.toFixed(1)}%`, warn: total > 100 },
    { icon: DollarSign, label: 'Bonus Yüzdesi', value: `${bonusTotal.toFixed(1)}%` },
    { icon: Users, label: 'Rütbe Sayısı', value: plan.ranks.length },
    { icon: Award, label: 'Maks. Payout', value: `${(total + bonusTotal).toFixed(1)}%` },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Review &amp; Save</h2>
        <p className="text-sm text-muted-foreground">
          Planını gözden geçir. Her şey doğru görünüyorsa &quot;Planı Kaydet&quot; butonu ile veritabanına yaz.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider">
              <k.icon className="h-3.5 w-3.5" />
              {k.label}
            </div>
            <div className={`font-mono text-2xl font-semibold mt-2 ${k.warn ? 'text-rose-400' : 'text-violet-300'}`}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {plan.commission.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Komisyon Tablosu</h3>
          <div className="flex flex-wrap gap-2">
            {plan.commission.map((c, i) => (
              <div key={i} className="inline-flex items-center gap-2 bg-muted rounded px-2.5 py-1 font-mono text-xs">
                <span className="text-muted-foreground">L{i + 1}</span>
                <span className="text-violet-300 font-semibold">{c}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.ranks.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Rütbeler</h3>
          <ul className="space-y-2">
            {plan.ranks.map((r, i) => (
              <li key={i} className="flex items-center gap-4 py-1.5 border-b border-border last:border-0">
                <span className="font-semibold min-w-[100px]">{r.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  PV {r.personalVolume} · GV {r.groupVolume} · {r.activeLegs} kol · +{r.bonus}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

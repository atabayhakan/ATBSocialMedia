'use client';
import { PLAN_METHODS, CompensationPlan } from '../types';
import { Check } from 'lucide-react';

interface Props {
  plan: CompensationPlan;
  onPick: (id: CompensationPlan['method']) => void;
}

export function Step1Method({ plan, onPick }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Choose Method</h2>
        <p className="text-sm text-muted-foreground">
          Aşağıdaki plan tiplerinden birini seç. Sonraki adımlarda genişlik, derinlik ve komisyon oranlarını ayarlayacaksın.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PLAN_METHODS.map((m) => {
          const active = plan.method === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              className={[
                'group relative text-left rounded-xl border p-5 transition-all',
                active
                  ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10'
                  : 'border-border bg-card hover:border-violet-500/50 hover:bg-card/80',
              ].join(' ')}
            >
              {active && (
                <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-violet-500">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div className="font-mono text-3xl text-violet-400 mb-3">{m.icon}</div>
              <div className="font-semibold mb-1.5">{m.name}</div>
              <div className="text-xs text-muted-foreground leading-relaxed mb-3">{m.desc}</div>
              <div className="flex gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>W: {m.defaultWidth}</span>
                <span>D: {m.defaultDepth}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

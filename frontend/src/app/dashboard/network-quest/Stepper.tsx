'use client';
import { Compass } from 'lucide-react';
import { STEPS } from './types';

interface Props {
  current: number;
  onJump: (n: number) => void;
}

export function Stepper({ current, onJump }: Props) {
  const pct = Math.round((current / STEPS.length) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Compass className="h-4 w-4 text-violet-400" />
        <span className="font-mono">{pct}% complete</span>
        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono">Step {current} of {STEPS.length}</span>
      </div>

      <ol className="flex flex-wrap gap-1.5">
        {STEPS.map((s) => {
          const state = s.id < current ? 'done' : s.id === current ? 'active' : 'pending';
          return (
            <li
              key={s.id}
              onClick={() => onJump(s.id)}
              className={[
                'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-all',
                state === 'active'
                  ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                  : state === 'done'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px]',
                  state === 'active'
                    ? 'bg-violet-500 text-white'
                    : state === 'done'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {s.id}
              </span>
              <span>{s.title}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

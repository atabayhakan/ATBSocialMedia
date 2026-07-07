'use client';
import { TreePreview } from '../TreePreview';
import { CompensationPlan } from '../types';

interface Props {
  plan: CompensationPlan;
  onDepth: (n: number) => void;
  onUnlimited: (on: boolean) => void;
}

export function Step3Depth({ plan, onDepth, onUnlimited }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Depth</h2>
        <p className="text-sm text-muted-foreground">
          Komisyon kaç seviye derinliğe kadar ödensin? Sonsuz derinlik (∞) ağacın doğal büyümesine izin verir.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 max-w-xl space-y-4">
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={plan.depthUnlimited}
            onChange={(e) => onUnlimited(e.target.checked)}
            className="h-4 w-4 accent-violet-500"
          />
          <span>Sonsuz derinlik (unlimited)</span>
        </label>

        {!plan.depthUnlimited && (
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-3">Depth (D)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={20}
                value={plan.depth}
                onChange={(e) => onDepth(Number(e.target.value))}
                className="flex-1 accent-violet-500"
              />
              <span className="font-mono text-3xl text-violet-400 min-w-[40px] text-right">{plan.depth}</span>
            </div>
            <div className="flex justify-between font-mono text-[10px] text-muted-foreground mt-2 px-1">
              <span>1</span>
              <span>5</span>
              <span>10</span>
              <span>15</span>
              <span>20</span>
            </div>
          </div>
        )}
      </div>

      <TreePreview width={plan.width} depth={plan.depth} unlimited={plan.depthUnlimited} method={plan.method} />
    </div>
  );
}

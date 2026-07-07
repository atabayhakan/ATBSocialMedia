'use client';
import { TreePreview } from '../TreePreview';
import { CompensationPlan } from '../types';

interface Props {
  plan: CompensationPlan;
  onWidth: (n: number) => void;
}

export function Step2Width({ plan, onWidth }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Width</h2>
        <p className="text-sm text-muted-foreground">
          Her üyenin kaç direkt alt kolu olabilir? Genelde 2 (binary) ile 5 (unilevel) arası tercih edilir.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 max-w-xl">
        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-3">Width (W)</label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={10}
            value={plan.width}
            onChange={(e) => onWidth(Number(e.target.value))}
            className="flex-1 accent-violet-500"
          />
          <span className="font-mono text-3xl text-violet-400 min-w-[40px] text-right">{plan.width}</span>
        </div>
        <div className="flex justify-between font-mono text-[10px] text-muted-foreground mt-2 px-1">
          <span>1</span>
          <span>5</span>
          <span>10</span>
        </div>
      </div>

      <TreePreview width={plan.width} depth={plan.depth} unlimited={plan.depthUnlimited} method={plan.method} />
    </div>
  );
}

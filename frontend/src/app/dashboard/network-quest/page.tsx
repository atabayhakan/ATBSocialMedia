'use client';
import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { api } from '@/lib/api';

import { Stepper } from './Stepper';
import { Step1Method } from './steps/Step1Method';
import { Step2Width } from './steps/Step2Width';
import { Step3Depth } from './steps/Step3Depth';
import { Step4Commission } from './steps/Step4Commission';
import { Step5Ranks } from './steps/Step5Ranks';
import { Step6Bonuses } from './steps/Step6Bonuses';
import { Step7Review } from './steps/Step7Review';

import { CompensationPlan, STEPS, defaultCommission, emptyPlan, Rank } from './types';

export default function NetworkQuestPage() {
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState<CompensationPlan>(emptyPlan());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCommission = useMemo(
    () => plan.commission.reduce((a, b) => a + b, 0),
    [plan.commission]
  );

  const canNext = useMemo(() => {
    if (step === 1 && !plan.method) return false;
    if (step === 4 && totalCommission > 100) return false;
    return true;
  }, [step, plan.method, totalCommission]);

  const isFirst = step === 1;
  const isLast = step === STEPS.length;

  function goNext() {
    if (!canNext) return;
    if (step < STEPS.length) setStep(step + 1);
  }
  function goPrev() {
    if (step > 1) setStep(step - 1);
  }
  function jumpTo(n: number) {
    if (n < 1 || n > STEPS.length) return;
    setStep(n);
  }

  function pickMethod(id: CompensationPlan['method']) {
    const defaults: Record<string, { w: number; d: number }> = {
      UNILEVEL: { w: 5, d: 5 },
      BINARY: { w: 2, d: 10 },
      MATRIX: { w: 3, d: 7 },
      HYBRID: { w: 4, d: 8 },
    };
    const d = defaults[id!] || defaults.UNILEVEL;
    setPlan({
      method: id,
      width: d.w,
      depth: d.d,
      depthUnlimited: false,
      commission: defaultCommission(d.d),
      ranks: [],
      bonuses: {},
    });
    setStep(2);
  }

  function setWidth(n: number) {
    setPlan((p) => ({ ...p, width: Math.max(1, Math.min(10, n)) }));
  }
  function setDepth(n: number) {
    const depth = Math.max(1, Math.min(20, n));
    setPlan((p) => ({ ...p, depthUnlimited: false, depth, commission: defaultCommission(depth) }));
  }
  function setUnlimited(on: boolean) {
    setPlan((p) => {
      const depth = on ? 99 : p.depth;
      return { ...p, depthUnlimited: on, depth, commission: defaultCommission(depth) };
    });
  }
  function setCommissionAt(idx: number, value: number) {
    setPlan((p) => {
      const next = [...p.commission];
      next[idx] = Math.max(0, Math.min(100, value || 0));
      return { ...p, commission: next };
    });
  }
  function addRank() {
    setPlan((p) => ({
      ...p,
      ranks: [
        ...p.ranks,
        { name: `Rank ${p.ranks.length + 1}`, personalVolume: 0, groupVolume: 0, activeLegs: 0, bonus: 0 },
      ],
    }));
  }
  function setRank(idx: number, patch: Partial<Rank>) {
    setPlan((p) => {
      const next = [...p.ranks];
      next[idx] = { ...next[idx], ...patch };
      return { ...p, ranks: next };
    });
  }
  function removeRank(idx: number) {
    setPlan((p) => ({ ...p, ranks: p.ranks.filter((_, i) => i !== idx) }));
  }
  function setBonus(id: string, value: number) {
    setPlan((p) => ({ ...p, bonuses: { ...p.bonuses, [id]: Math.max(0, Math.min(100, value || 0)) } }));
  }
  function reset() {
    setPlan(emptyPlan());
    setStep(1);
    setSaved(false);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/compensation-plans', {
        name: `${plan.method} Plan`,
        method: plan.method,
        width: plan.width,
        depth: plan.depth,
        depthUnlimited: plan.depthUnlimited,
        config: JSON.parse(JSON.stringify(plan)),
        status: 'DRAFT',
      });
      setSaved(true);
      toast.success('Plan kaydedildi');
    } catch (e: any) {
      const msg = e?.message || 'Kayıt başarısız';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Network Quest</h1>
          <p className="text-sm text-muted-foreground">
            Build Any Compensation Plan · 5 steps. Drag-and-drop. Watch your network grow.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="mr-2 h-3.5 w-3.5" /> Sıfırla
        </Button>
      </div>

      <Stepper current={step} onJump={jumpTo} />

      <Card>
        <CardContent className="p-6">
          {step === 1 && <Step1Method plan={plan} onPick={pickMethod} />}
          {step === 2 && <Step2Width plan={plan} onWidth={setWidth} />}
          {step === 3 && <Step3Depth plan={plan} onDepth={setDepth} onUnlimited={setUnlimited} />}
          {step === 4 && <Step4Commission plan={plan} onSet={setCommissionAt} />}
          {step === 5 && <Step5Ranks plan={plan} onAdd={addRank} onSet={setRank} onRemove={removeRank} />}
          {step === 6 && <Step6Bonuses plan={plan} onSet={setBonus} />}
          {step === 7 && <Step7Review plan={plan} />}
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Plan başarıyla kaydedildi.
        </div>
      )}

      <div className="flex items-center justify-between sticky bottom-0 bg-background/80 backdrop-blur p-4 -mx-4 border-t border-border">
        <Button variant="outline" disabled={isFirst} onClick={goPrev}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          Step {step} of {STEPS.length}
        </span>
        {!isLast ? (
          <Button variant="gradient" disabled={!canNext} onClick={goNext}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button variant="gradient" disabled={saving} onClick={save}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Kaydediliyor...' : 'Planı Kaydet'}
          </Button>
        )}
      </div>
    </div>
  );
}

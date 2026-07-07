'use client';
import { useMemo } from 'react';

interface Props {
  width: number;
  depth: number;
  unlimited?: boolean;
  method?: string | null;
}

interface Node {
  x: number;
  y: number;
  parentX?: number;
  parentY?: number;
  label: string;
  level: number;
}

const MAX_PREVIEW_NODES = 600;

function totalNodes(w: number, d: number): number {
  return w === 1 ? d + 1 : (Math.pow(w, d + 1) - 1) / (w - 1);
}

export function TreePreview({ width, depth, unlimited, method }: Props) {
  const layout = useMemo(() => {
    const w = Math.max(1, Math.min(10, width));
    let d = unlimited ? 4 : Math.max(1, Math.min(8, depth));
    while (d > 1 && totalNodes(w, d) > MAX_PREVIEW_NODES) d--;
    const W = 800;
    const H = 60 + d * 70;
    const rootX = W / 2;
    const nodes: Node[] = [{ x: rootX, y: 30, level: 0, label: 'YOU' }];

    for (let level = 1; level <= d; level++) {
      const slots = Math.pow(w, level);
      const y = 30 + level * 60;
      const span = Math.min(W - 60, slots * 50);
      const startX = (W - span) / 2;
      const stepX = slots > 1 ? span / (slots - 1) : 0;

      for (let i = 0; i < slots; i++) {
        const x = slots === 1 ? rootX : startX + i * stepX;
        const parentIdx = Math.floor(i / w);
        const parentLevel = level - 1;
        const parentSlot = Math.pow(w, parentLevel);
        const parentSpan = Math.min(W - 60, parentSlot * 50);
        const parentStart = (W - parentSpan) / 2;
        const parentStep = parentSlot > 1 ? parentSpan / (parentSlot - 1) : 0;
        const parentX = parentSlot === 1 ? rootX : parentStart + parentIdx * parentStep;
        nodes.push({ x, y, parentX, parentY: y - 60, level, label: 'L' + level });
      }
    }

    return { nodes, W, H };
  }, [width, depth, unlimited]);

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <svg viewBox={`0 0 ${layout.W} ${layout.H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-auto max-h-64">
        <g stroke="hsl(var(--border))" strokeWidth="1" fill="none">
          {layout.nodes
            .filter((n) => n.level > 0)
            .map((n, i) => (
              <line key={'e' + i} x1={n.parentX} y1={n.parentY} x2={n.x} y2={n.y} />
            ))}
        </g>
        <g>
          {layout.nodes.map((n, i) => (
            <g key={'n' + i} transform={`translate(${n.x},${n.y})`}>
              <circle
                r="9"
                fill={n.level === 0 ? 'rgb(139 92 246)' : 'hsl(var(--muted))'}
                stroke={n.level === 0 ? 'rgb(139 92 246)' : 'hsl(var(--border))'}
                strokeWidth="1"
              />
              <text
                y="3"
                textAnchor="middle"
                fontSize="9"
                fontFamily="monospace"
                fill={n.level === 0 ? 'white' : 'hsl(var(--muted-foreground))'}
              >
                {n.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
      <div className="mt-2 text-right font-mono text-[10px] text-muted-foreground tracking-wider">
        {method || 'PLAN'} · W={width} · D={unlimited ? '∞' : depth}
      </div>
    </div>
  );
}

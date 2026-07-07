export interface PlanMethod {
  id: 'UNILEVEL' | 'BINARY' | 'MATRIX' | 'HYBRID';
  name: string;
  desc: string;
  icon: string;
  defaultWidth: number;
  defaultDepth: number;
}

export const PLAN_METHODS: PlanMethod[] = [
  {
    id: 'UNILEVEL',
    name: 'Unilevel',
    desc: 'Her üye, doğrudan altındaki tüm seviyelere kadar komisyon alır. Geniş, sığ ağaçlar.',
    icon: '▦',
    defaultWidth: 5,
    defaultDepth: 5,
  },
  {
    id: 'BINARY',
    name: 'Binary',
    desc: 'Her üyenin sadece 2 kolu olur. Sol/sağ hacim eşitlemesiyle ödeme yapılır.',
    icon: '◫',
    defaultWidth: 2,
    defaultDepth: 10,
  },
  {
    id: 'MATRIX',
    name: 'Matrix',
    desc: 'Sabit W×D matris. W koltuk × D derinlik. Spillover kuralı ile doldurulur.',
    icon: '▥',
    defaultWidth: 3,
    defaultDepth: 7,
  },
  {
    id: 'HYBRID',
    name: 'Hybrid',
    desc: 'Unilevel + Binary birleşimi. Hem seviye komisyonu hem binary eşitleme.',
    icon: '◈',
    defaultWidth: 4,
    defaultDepth: 8,
  },
];

export interface BonusType {
  id: string;
  name: string;
  desc: string;
  default: number;
}

export const BONUS_TYPES: BonusType[] = [
  { id: 'FAST_START', name: 'Fast Start', desc: 'İlk 30-60 gün ek yüzde', default: 5 },
  { id: 'MATCHING', name: 'Matching', desc: 'Downline kazancının belirli % i (sponsor için)', default: 50 },
  { id: 'LEADERSHIP', name: 'Leadership Pool', desc: 'Şirket cirosundan rütbeye göre pay', default: 2 },
  { id: 'RETENTION', name: 'Retention', desc: 'Tekrar eden aylık / yıllık ödeme', default: 3 },
  { id: 'CUSTOM', name: 'Custom', desc: 'Özel bonus — ad ve değer serbest', default: 0 },
];

export interface Rank {
  name: string;
  personalVolume: number;
  groupVolume: number;
  activeLegs: number;
  bonus: number;
}

export interface CompensationPlan {
  method: PlanMethod['id'] | null;
  width: number;
  depth: number;
  depthUnlimited: boolean;
  commission: number[];
  ranks: Rank[];
  bonuses: Record<string, number>;
}

export interface Step {
  id: number;
  key: string;
  title: string;
  hint: string;
}

export const STEPS: Step[] = [
  { id: 1, key: 'method', title: 'Choose Method', hint: 'Planın genel tipi' },
  { id: 2, key: 'width', title: 'Width', hint: 'Her düğümün kaç alt kolu olur' },
  { id: 3, key: 'depth', title: 'Depth', hint: 'Komisyon hangi seviyeye kadar ödenir' },
  { id: 4, key: 'commission', title: 'Commission', hint: 'Seviye bazlı yüzdeler' },
  { id: 5, key: 'ranks', title: 'Ranks', hint: 'Rütbe basamakları ve kriterleri' },
  { id: 6, key: 'bonuses', title: 'Bonuses', hint: 'Ek gelir türleri' },
  { id: 7, key: 'review', title: 'Review & Save', hint: 'Özet ve kayıt' },
];

export function emptyPlan(): CompensationPlan {
  return {
    method: null,
    width: 5,
    depth: 5,
    depthUnlimited: false,
    commission: [],
    ranks: [],
    bonuses: {},
  };
}

export function defaultCommission(depth: number): number[] {
  const base = [10, 5, 3, 2, 1.5, 1, 1, 1, 0.5, 0.5];
  return Array.from({ length: depth }, (_, i) => base[i] ?? 0.5);
}

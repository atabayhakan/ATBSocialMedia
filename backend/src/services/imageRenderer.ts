// Kullanıcının yüklediği arka plan görseline AI'ın ürettiği metni bindirip
// paylaşıma hazır bir görsel üretir. Canva Autofill'in yerini alır — o özellik
// Canva Enterprise plana kilitli olduğu için kendi sunucumuzda, ücretsiz üretiyoruz.
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import path from 'path';

const FONT_DIR = path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
const FONT_REGULAR = path.join(FONT_DIR, 'DejaVuSans.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'DejaVuSans-Bold.ttf');
const FONT_FAMILY = 'ATB Sans';
const FONT_FAMILY_BOLD = 'ATB Sans Bold';

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  GlobalFonts.registerFromPath(FONT_REGULAR, FONT_FAMILY);
  GlobalFonts.registerFromPath(FONT_BOLD, FONT_FAMILY_BOLD);
  fontsRegistered = true;
}

export type PanelPosition = 'TOP' | 'CENTER' | 'BOTTOM';
export type TextColor = 'LIGHT' | 'DARK';

export interface RenderTemplate {
  backgroundPath: string; // diskteki mutlak dosya yolu
  width: number;
  height: number;
  panelPosition: PanelPosition;
  textColor: TextColor;
}

export interface RenderContent {
  title: string;
  body: string;
  hashtags: string[];
}

function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderPostImage(template: RenderTemplate, content: RenderContent): Promise<Buffer> {
  ensureFonts();
  const { width, height, panelPosition, textColor } = template;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Arka plan: cover-fit (kırp + ortala), oranı bozmadan tüm alanı kapla
  const bg = await loadImage(template.backgroundPath);
  const scale = Math.max(width / bg.width, height / bg.height);
  const drawW = bg.width * scale;
  const drawH = bg.height * scale;
  ctx.drawImage(bg, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);

  // Metnin okunabilirliği için yarı saydam degrade panel
  const panelHeight = Math.round(height * 0.42);
  const panelY = panelPosition === 'TOP' ? 0 : panelPosition === 'CENTER' ? (height - panelHeight) / 2 : height - panelHeight;
  const rgb = textColor === 'LIGHT' ? '0, 0, 0' : '255, 255, 255';
  const gradient = ctx.createLinearGradient(0, panelY, 0, panelY + panelHeight);
  if (panelPosition === 'BOTTOM') {
    gradient.addColorStop(0, `rgba(${rgb}, 0)`);
    gradient.addColorStop(0.35, `rgba(${rgb}, 0.75)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0.88)`);
  } else if (panelPosition === 'TOP') {
    gradient.addColorStop(0, `rgba(${rgb}, 0.88)`);
    gradient.addColorStop(0.65, `rgba(${rgb}, 0.75)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  } else {
    gradient.addColorStop(0, `rgba(${rgb}, 0.85)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0.85)`);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, panelY, width, panelHeight);

  const textFill = textColor === 'LIGHT' ? '#ffffff' : '#0f0f14';
  const paddingX = Math.round(width * 0.07);
  const maxTextWidth = width - paddingX * 2;
  ctx.fillStyle = textFill;
  ctx.textBaseline = 'top';
  let cursorY = panelY + Math.round(panelHeight * 0.2);

  // Başlık
  const titleSize = Math.round(width * 0.052);
  ctx.font = `${titleSize}px "${FONT_FAMILY_BOLD}"`;
  const titleLines = wrapText(ctx, content.title, maxTextWidth).slice(0, 3);
  for (const line of titleLines) {
    ctx.fillText(line, paddingX, cursorY);
    cursorY += titleSize * 1.25;
  }
  cursorY += titleSize * 0.35;

  // Gövde
  const bodySize = Math.round(width * 0.03);
  ctx.font = `${bodySize}px "${FONT_FAMILY}"`;
  const bodyLines = wrapText(ctx, content.body, maxTextWidth).slice(0, 4);
  for (const line of bodyLines) {
    ctx.fillText(line, paddingX, cursorY);
    cursorY += bodySize * 1.4;
  }

  // Hashtag'ler — panelin altına yaslanır
  if (content.hashtags.length) {
    const tagSize = Math.round(width * 0.024);
    ctx.font = `${tagSize}px "${FONT_FAMILY}"`;
    ctx.globalAlpha = 0.85;
    const tagLine = content.hashtags.slice(0, 6).join('  ');
    const tagY = Math.max(panelY + panelHeight - tagSize * 1.8, cursorY + tagSize);
    ctx.fillText(tagLine, paddingX, tagY);
    ctx.globalAlpha = 1;
  }

  return canvas.encode('png');
}

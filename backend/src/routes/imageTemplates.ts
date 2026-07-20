// Kullanıcının yüklediği arka plan görsellerini yönetir; AI metnini bindirip
// paylaşıma hazır görsel üretir (Canva Autofill'in Enterprise-kilitli olmayan
// yerine geçen kendi sunucumuzdaki çözüm).
import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { mediaBaseUrl } from '../lib/env';
import { renderPostImage, type PanelPosition, type TextColor } from '../services/imageRenderer';

const router = Router();

const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
const TEMPLATES_DIR = path.join(UPLOADS_ROOT, 'templates');
const GENERATED_DIR = path.join(UPLOADS_ROOT, 'generated');
fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
fs.mkdirSync(GENERATED_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) {
      return cb(new Error('Yalnızca PNG/JPEG/WEBP görsel kabul edilir'));
    }
    cb(null, true);
  },
});

function publicUrl(diskPath: string) {
  const rel = path.relative(UPLOADS_ROOT, diskPath).replace(/\\/g, '/');
  return `${mediaBaseUrl}/media/${rel}`;
}

function sanitize(t: any) {
  return {
    id: t.id,
    name: t.name,
    width: t.width,
    height: t.height,
    panelPosition: t.panelPosition,
    textColor: t.textColor,
    isDefault: t.isDefault,
    previewUrl: publicUrl(t.backgroundPath),
    createdAt: t.createdAt,
  };
}

router.get('/', async (req, res) => {
  const userId = req.userId!;
  const templates = await prisma.imageTemplate.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  res.json(templates.map(sanitize));
});

router.post('/', upload.single('background'), async (req, res) => {
  try {
    const userId = req.userId!;
    if (!req.file) return res.status(400).json({ error: 'Arka plan görseli gerekli' });

    const name = (req.body?.name || 'Şablon').toString().slice(0, 80);
    const panelPosition = (req.body?.panelPosition || 'BOTTOM') as PanelPosition;
    const textColor = (req.body?.textColor || 'LIGHT') as TextColor;
    if (!['TOP', 'CENTER', 'BOTTOM'].includes(panelPosition)) {
      return res.status(400).json({ error: 'Geçersiz panelPosition' });
    }
    if (!['LIGHT', 'DARK'].includes(textColor)) {
      return res.status(400).json({ error: 'Geçersiz textColor' });
    }

    const ext = (req.file.mimetype.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const fileName = `${randomUUID()}.${ext}`;
    const filePath = path.join(TEMPLATES_DIR, fileName);
    fs.writeFileSync(filePath, req.file.buffer);

    const isDefault = req.body?.isDefault === 'true' || req.body?.isDefault === true;
    if (isDefault) {
      await prisma.imageTemplate.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }

    const template = await prisma.imageTemplate.create({
      data: { userId, name, backgroundPath: filePath, width: 1080, height: 1350, panelPosition, textColor, isDefault },
    });
    res.status(201).json(sanitize(template));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const userId = req.userId!;

  const data: Record<string, any> = {};
  if (req.body?.name !== undefined) data.name = String(req.body.name).slice(0, 80);
  if (req.body?.panelPosition !== undefined) {
    if (!['TOP', 'CENTER', 'BOTTOM'].includes(req.body.panelPosition)) {
      return res.status(400).json({ error: 'Geçersiz panelPosition' });
    }
    data.panelPosition = req.body.panelPosition;
  }
  if (req.body?.textColor !== undefined) {
    if (!['LIGHT', 'DARK'].includes(req.body.textColor)) {
      return res.status(400).json({ error: 'Geçersiz textColor' });
    }
    data.textColor = req.body.textColor;
  }

  if (req.body?.isDefault === true) {
    await prisma.imageTemplate.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    data.isDefault = true;
  } else if (req.body?.isDefault === false) {
    data.isDefault = false;
  }

  const { count } = await prisma.imageTemplate.updateMany({ where: { id: req.params.id, userId }, data });
  if (!count) return res.status(404).json({ error: 'Şablon bulunamadı' });
  const template = await prisma.imageTemplate.findUnique({ where: { id: req.params.id } });
  res.json(sanitize(template));
});

router.delete('/:id', async (req, res) => {
  const userId = req.userId!;
  const template = await prisma.imageTemplate.findFirst({ where: { id: req.params.id, userId } });
  if (!template) return res.status(404).json({ error: 'Şablon bulunamadı' });
  await prisma.imageTemplate.delete({ where: { id: template.id } });
  fs.rm(template.backgroundPath, { force: true }, () => {});
  res.status(204).end();
});

router.post('/:id/preview', async (req, res) => {
  try {
    const userId = req.userId!;
    const template = await prisma.imageTemplate.findFirst({ where: { id: req.params.id, userId } });
    if (!template) return res.status(404).json({ error: 'Şablon bulunamadı' });

    const sample = {
      title: req.body?.title || 'Örnek Başlık: Ürün Lansmanı',
      body: req.body?.body || 'AI tarafından üretilen gönderi metni burada görünecek. Bu bir önizlemedir.',
      hashtags: req.body?.hashtags || ['#örnek', '#önizleme'],
    };

    const buf = await renderPostImage(
      {
        backgroundPath: template.backgroundPath,
        width: template.width,
        height: template.height,
        panelPosition: template.panelPosition as PanelPosition,
        textColor: template.textColor as TextColor,
      },
      sample
    );

    const previewPath = path.join(GENERATED_DIR, `preview-${template.id}.png`);
    fs.writeFileSync(previewPath, buf);
    res.json({ url: `${publicUrl(previewPath)}?t=${Date.now()}` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

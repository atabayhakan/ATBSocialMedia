import { Router } from 'express';
import * as planner from '../services/planner';

const router = Router();

router.get('/slots', async (req, res) => {
  const slots = await planner.listSlots(req.userId!);
  res.json(slots);
});

router.post('/slots/generate', async (req, res) => {
  const result = await planner.generateSlotsFromCadence(req.userId!);
  res.json(result);
});

router.delete('/slots/:id', async (req, res) => {
  try {
    await planner.deleteSlot(req.userId!, req.params.id);
    res.status(204).end();
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

export default router;

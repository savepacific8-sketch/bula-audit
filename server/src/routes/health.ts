import { Router } from 'express';
import { prisma } from '../prisma.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'up', ts: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

export default router;

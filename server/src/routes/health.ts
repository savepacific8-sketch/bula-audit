import { Router } from 'express';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { isEmailConfigured } from '../lib/email.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      db: 'up',
      ts: new Date().toISOString(),
      email: {
        driver: env.EMAIL_DRIVER,
        configured: isEmailConfigured,
        from: env.EMAIL_FROM,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

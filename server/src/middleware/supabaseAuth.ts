import type { Request, Response, NextFunction } from 'express';
import { env } from '../env.js';
import { HttpError } from './error.js';
import { getTokenFromRequest, verifyToken } from './auth.js';
import { prisma } from '../prisma.js';

export interface SupabaseAuthUser {
  id: string;
  email?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      supabaseAuth?: SupabaseAuthUser;
    }
  }
}

/** Express JWT (MySQL users) or Supabase session JWT (Supabase-only users). */
export async function requireAuthOrSupabase(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const token = getTokenFromRequest(req);
  if (!token) return next(new HttpError(401, 'Authentication required'));

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user) {
      if (typeof payload.tv === 'number' && payload.tv !== user.tokenVersion) {
        return next(new HttpError(401, 'Session revoked'));
      }
      req.user = user;
      return next();
    }
  } catch {
    /* try Supabase */
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return next(new HttpError(401, 'Invalid or expired token'));
  }

  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });
    if (!res.ok) return next(new HttpError(401, 'Invalid or expired token'));
    const data = (await res.json()) as { id?: string; email?: string };
    if (!data.id) return next(new HttpError(401, 'Invalid or expired token'));
    req.supabaseAuth = { id: data.id, email: data.email };
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid or expired token'));
  }
}

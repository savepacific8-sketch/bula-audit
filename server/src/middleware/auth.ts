import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { env } from '../env.js';
import { prisma } from '../prisma.js';
import { HttpError } from './error.js';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  tv: number; // token version (bumped on logout-everywhere)
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

function getTokenFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.token;
  if (typeof cookieToken === 'string') return cookieToken;
  return null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) throw new HttpError(401, 'Authentication required');

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new HttpError(401, 'User no longer exists');

    // Invalidate access tokens issued before a logout-everywhere
    if (typeof payload.tv === 'number' && payload.tv !== user.tokenVersion) {
      throw new HttpError(401, 'Session revoked');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof HttpError) return next(err);
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Authentication required'));
  if (req.user.role !== 'admin') return next(new HttpError(403, 'Admin only'));
  next();
}

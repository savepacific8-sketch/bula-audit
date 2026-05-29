import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { env } from '../env.js';

export class HttpError extends Error {
  status: number;
  details?: unknown;
  expose: boolean;
  constructor(status: number, message: string, details?: unknown, expose = true) {
    super(message);
    this.status = status;
    this.details = details;
    this.expose = expose;
  }
}

export const notFound = (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
};

const isProd = env.NODE_ENV === 'production';

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // Validation errors are safe to expose (they describe bad client input)
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', issues: err.flatten() });
    return;
  }

  // Explicit HttpError — only expose message when allowed
  if (err instanceof HttpError) {
    const body: Record<string, unknown> = {
      error: err.expose ? err.message : 'Request failed',
    };
    if (err.details && !isProd) body.details = err.details;
    res.status(err.status).json(body);
    return;
  }

  // Prisma — map known DB errors to friendly status codes; never leak details
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Resource already exists' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Record not found' });
      return;
    }
    console.error('[prisma] known error:', err.code, err.message);
    res.status(400).json({ error: 'Invalid database operation' });
    return;
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error('[prisma] validation error:', err.message);
    res.status(400).json({ error: 'Invalid request data' });
    return;
  }

  // Everything else — log internally, return generic message externally
  console.error('[unhandled error]', err);
  if (isProd) {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
};

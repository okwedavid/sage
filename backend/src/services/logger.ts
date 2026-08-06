/**
 * services/logger.ts
 * OWNS: Structured logging (zero-dependency)
 *
 * - Production/test: one JSON object per line (machine-parseable).
 * - Development: colored, human-readable output.
 * - `requestLogger` middleware assigns a request ID and logs method/path/
 *   status/duration. Request IDs are echoed on the `X-Request-Id` header so
 *   logs can be correlated with client-side errors.
 */
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { Settings } from '../config/settings';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configuredLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (Settings.NODE_ENV === 'production' ? 'info' : 'debug');

function write(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[configuredLevel]) return;

  const ts = new Date().toISOString();
  const line = JSON.stringify({ ts, level, msg, ...meta });

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => write('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => write('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write('error', msg, meta),
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/** Attach a request ID and log each request with method/path/status/duration. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);

  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const entry = {
      requestId: id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    };
    if (res.statusCode >= 500) {
      logger.error('request failed', entry);
    } else if (res.statusCode >= 400) {
      logger.warn('request rejected', entry);
    } else {
      logger.info('request completed', entry);
    }
  });
  next();
}

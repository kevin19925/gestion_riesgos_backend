/**
 * Middleware de autenticación JWT.
 * - publicPaths: rutas que no requieren token (ej. login, health).
 * - required: si true, el resto de rutas exigen token válido.
 */
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

const DEFAULT_PUBLIC_PATHS = ['/api/health', '/api/auth/login'];

function isPublicPath(path: string, method: string, publicPaths: string[]): boolean {
  const full = path.endsWith('/') ? path.slice(0, -1) : path;
  return publicPaths.some((p) => {
    if (p === '/api/auth/login') return (full === p || full.endsWith('/auth/login')) && method === 'POST';
    return full === p || full.endsWith(p);
  });
}

export function authMiddleware(options?: { required?: boolean; publicPaths?: string[] }) {
  const required = options?.required ?? false;
  const publicPaths = options?.publicPaths ?? DEFAULT_PUBLIC_PATHS;

  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.originalUrl?.split('?')[0] || req.path;
    if (required && isPublicPath(path, req.method, publicPaths)) {
      return next();
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      if (required) {
        console.log('❌ [AUTH] Token no proporcionado para:', path);
        return res.status(401).json({ error: 'No autorizado', message: 'Token requerido' });
      }
      return next();
    }

    const payload = verifyToken(token);
    if (!payload) {
      if (required) {
        console.log('❌ [AUTH] Token inválido o expirado para:', path);
        return res.status(401).json({ error: 'No autorizado', message: 'Token inválido o expirado' });
      }
      return next();
    }

    (req as any).user = payload;
    next();
  };
}

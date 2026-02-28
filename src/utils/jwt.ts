/**
 * JWT: firma y verificación de tokens para autenticación segura.
 * Usar JWT_SECRET en .env (mín. 32 caracteres en producción).
 */
import jwt from 'jsonwebtoken';

const SECRET: string = process.env.JWT_SECRET || 'default-secret-cambiar-en-produccion';
const EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as string;

export interface JwtPayload {
  userId: number;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload as object, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function getSecret(): string {
  return SECRET;
}

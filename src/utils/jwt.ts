/**
 * JWT: firma y verificación de tokens para autenticación segura.
 * Usar JWT_SECRET en .env (mín. 32 caracteres en producción).
 */
import 'dotenv/config';
import jwt from 'jsonwebtoken';

function getEnvSecret(): string {
  const secret = process.env.JWT_SECRET || '';
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and contain at least 32 characters');
  }
  return secret;
}

const SECRET: string = getEnvSecret();
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

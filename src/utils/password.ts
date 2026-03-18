import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export function looksHashed(password: string): boolean {
  return typeof password === 'string' && /^\$2[aby]\$\d{2}\$/.test(password);
}

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword: string, storedPassword: string): Promise<boolean> {
  if (!storedPassword) return false;

  if (looksHashed(storedPassword)) {
    return bcrypt.compare(plainPassword, storedPassword);
  }

  // Transitional compatibility for legacy plain-text passwords.
  return plainPassword === storedPassword;
}

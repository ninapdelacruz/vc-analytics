import crypto from 'crypto';

export function hashAccessCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex').toLowerCase();
}

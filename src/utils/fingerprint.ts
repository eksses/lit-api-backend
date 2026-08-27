import crypto from 'crypto';

/**
 * Computes a SHA-256 device hash from client fingerprint header, user agent, and client IP address.
 */
export function computeDeviceHash(clientFingerprint: string, userAgent: string, clientIp: string): string {
  const payload = (clientFingerprint || '') + (userAgent || '') + (clientIp || '');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

import { Request, Response, NextFunction } from 'express';
import { computeDeviceHash } from '../utils/fingerprint.js';

/**
 * Express middleware to compute and attach req.deviceHash based on client headers and IP.
 */
export function fingerprintMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const clientFingerprintHeader = req.headers['x-device-fingerprint'];
  const clientFingerprint = Array.isArray(clientFingerprintHeader)
    ? clientFingerprintHeader[0]
    : clientFingerprintHeader || 'anon_guest';

  const userAgentHeader = req.headers['user-agent'];
  const userAgent = Array.isArray(userAgentHeader)
    ? userAgentHeader[0]
    : userAgentHeader || '';

  const forwardedFor = req.headers['x-forwarded-for'];
  let clientIp = '';

  if (forwardedFor) {
    if (Array.isArray(forwardedFor)) {
      clientIp = forwardedFor[0];
    } else {
      clientIp = forwardedFor.split(',')[0].trim();
    }
  } else {
    clientIp = req.ip || req.socket?.remoteAddress || '';
  }

  req.deviceHash = computeDeviceHash(clientFingerprint, userAgent, clientIp);
  next();
}

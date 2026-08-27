import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserPayload } from '../types/express.d.js';

const JWT_SECRET = process.env.JWT_SECRET || 'lit_mobile_pwa_secret_jwt_key_2026_super_secure';

/**
 * Extracts JWT token from httpOnly cookie or Authorization header.
 */
export function extractToken(req: Request): string | null {
  if (req.cookies && req.cookies.auth_token) {
    return req.cookies.auth_token;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Optional Auth Middleware:
 * Verifies JWT token if present and populates req.user.
 * Does not reject requests if token is missing or invalid.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    req.user = undefined;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    req.user = decoded;
  } catch (_err) {
    req.user = undefined;
  }

  next();
}

/**
 * Require Auth Middleware:
 * Rejects requests with 401 Unauthorized if req.user is not populated or valid token is missing.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    const token = extractToken(req);
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
        req.user = decoded;
      } catch (_err) {
        req.user = undefined;
      }
    }
  }

  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    return;
  }

  next();
}

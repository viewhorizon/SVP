import type { NextFunction, Request, Response } from 'express';

export type AuthUser = {
  uid: string;
  email?: string;
};

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

// Este middleware asume integración previa con Firebase Admin SDK.
// Si req.user ya viene hidratado por el verificador de token, continúa.
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  if (!req.user?.uid) {
    return res.status(401).json({ error: 'Token inválido o no verificado' });
  }

  return next();
}

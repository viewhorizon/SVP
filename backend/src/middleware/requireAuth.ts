import type { NextFunction, Request, Response } from 'express';
import { applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export type AuthUser = {
  uid: string;
  email?: string;
};

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

const DEMO_UID_FALLBACK = '11111111-1111-1111-1111-111111111111';
const AUTH_MODE = String(process.env.AUTH_MODE ?? 'auto').toLowerCase();
const ALLOW_INSECURE_FALLBACK = String(process.env.AUTH_INSECURE_FALLBACK ?? 'false').toLowerCase() === 'true';

function extractUidFromBearer(token: string): string {
  const cleaned = token.trim();
  if (!cleaned) return DEMO_UID_FALLBACK;
  if (cleaned.startsWith('dev:')) {
    const candidate = cleaned.slice(4).trim();
    return candidate || DEMO_UID_FALLBACK;
  }
  return cleaned;
}

type FirebaseServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function getFirebaseServiceAccount(): FirebaseServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FirebaseServiceAccount;
    if (!parsed.projectId || !parsed.clientEmail || !parsed.privateKey) return null;
    return {
      projectId: parsed.projectId,
      clientEmail: parsed.clientEmail,
      privateKey: parsed.privateKey.replace(/\\n/g, '\n'),
    };
  } catch {
    return null;
  }
}

function getOrInitFirebaseApp() {
  if (getApps().length > 0) return getApp();
  const serviceAccount = getFirebaseServiceAccount();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  }
  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

async function verifyFirebaseToken(token: string): Promise<AuthUser | null> {
  const app = getOrInitFirebaseApp();
  const decoded = await getAuth(app).verifyIdToken(token, true);
  return {
    uid: decoded.uid,
    email: decoded.email,
  };
}

// Este middleware asume integración previa con Firebase Admin SDK.
// Si req.user ya viene hidratado por el verificador de token, continúa.
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.slice(7).trim();

  if (AUTH_MODE !== 'firebase' && token.startsWith('dev:')) {
    req.user = { uid: extractUidFromBearer(token) };
    return next();
  }

  if (!req.user?.uid) {
    try {
      const verified = await verifyFirebaseToken(token);
      if (verified?.uid) {
        req.user = verified;
      }
    } catch (error) {
      if (AUTH_MODE === 'firebase') {
        const message = error instanceof Error ? error.message : 'Token invalido';
        return res.status(401).json({ error: `Token no verificado por Firebase: ${message}` });
      }
      if (ALLOW_INSECURE_FALLBACK) {
        req.user = { uid: extractUidFromBearer(token) };
      }
    }
  }

  if (!req.user?.uid) {
    return res.status(401).json({ error: 'Token inválido o no verificado' });
  }

  return next();
}
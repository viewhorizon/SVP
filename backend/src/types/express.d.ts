import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      uid: string;
      email?: string;
    };
    rawBody?: Buffer;
    requestId?: string;
  }
}
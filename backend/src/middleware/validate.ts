import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

const mapIssue = (issue: { path: Array<string | number>; message: string }) => ({
  path: issue.path.join('.'),
  message: issue.message,
});

export const validateBody = <T extends ZodTypeAny>(schema: T): RequestHandler => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Body invalido',
      details: parsed.error.issues.map(mapIssue),
    });
  }
  res.locals.validatedBody = parsed.data;
  return next();
};

export const validateQuery = <T extends ZodTypeAny>(schema: T): RequestHandler => (req, res, next) => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Query invalida',
      details: parsed.error.issues.map(mapIssue),
    });
  }
  res.locals.validatedQuery = parsed.data;
  return next();
};

export const validateParams = <T extends ZodTypeAny>(schema: T): RequestHandler => (req, res, next) => {
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Params invalidos',
      details: parsed.error.issues.map(mapIssue),
    });
  }
  res.locals.validatedParams = parsed.data;
  return next();
};
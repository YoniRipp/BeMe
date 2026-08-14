/**
 * Request body validation middleware using Zod.
 * On failure sends 400 in the standard error envelope with the first error
 * message (plus formatted Zod errors outside production).
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { firstZodErrorMessage } from '../utils/validation.js';
import { sendError } from '../utils/response.js';

export function validateBody(schema: ZodSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      req.body = result.data;
      next();
      return;
    }
    const err = result.error;
    return sendError(res, 400, firstZodErrorMessage(err), {
      code: 'VALIDATION_ERROR',
      ...(process.env.NODE_ENV !== 'production' ? { details: err.flatten() } : {}),
    });
  };
}

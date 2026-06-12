/**
 * Request body validation middleware using Zod.
 * On failure sends 400 with first error message or formatted Zod errors.
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { firstZodErrorMessage } from '../utils/validation.js';

export function validateBody(schema: ZodSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      req.body = result.data;
      next();
      return;
    }
    const err = result.error;
    const response: Record<string, unknown> = { error: firstZodErrorMessage(err) };
    if (process.env.NODE_ENV !== 'production') {
      response.details = err.flatten();
    }
    return res.status(400).json(response);
  };
}

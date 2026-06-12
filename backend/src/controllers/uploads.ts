/**
 * Uploads controller — issues pre-signed S3 URLs for direct browser-to-S3 uploads.
 *
 * Flow:
 *   1. Client POST /api/uploads/presigned-url { mimeType, context }
 *   2. Server generates a 5-minute pre-signed PUT URL and returns { uploadUrl, fileUrl, key }
 *   3. Client PUTs the file directly to S3 (no server bandwidth)
 *   4. Client stores fileUrl on its profile/record
 */
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendJson, sendError } from '../utils/response.js';
import { createPresignedUploadUrl, CONTEXT_MIME_TYPES } from '../services/storage.js';
import { config } from '../config/index.js';

export const presignedUrl = asyncHandler(async (req: Request, res: Response) => {
  if (!config.awsRegion || !config.awsS3Bucket) {
    return sendError(res, 503, 'File uploads not configured (AWS_REGION and AWS_S3_BUCKET required)');
  }

  const { mimeType, context = 'avatar' } = req.body ?? {};

  if (!mimeType || typeof mimeType !== 'string') {
    return sendError(res, 400, 'mimeType is required');
  }

  const allowedMimeTypes = CONTEXT_MIME_TYPES[context];
  if (!allowedMimeTypes) {
    return sendError(res, 400, `context must be one of: ${Object.keys(CONTEXT_MIME_TYPES).join(', ')}`);
  }

  if (!allowedMimeTypes.includes(mimeType)) {
    return sendError(res, 400, `Unsupported file type for ${context}: ${mimeType}. Allowed: ${allowedMimeTypes.join(', ')}`, { code: 'VALIDATION_ERROR' });
  }

  const { uploadUrl, fileUrl, key } = await createPresignedUploadUrl(req.user!.id, mimeType, context);

  return sendJson(res, {
    uploadUrl,
    fileUrl,
    key,
    expiresIn: 300,
  });
});

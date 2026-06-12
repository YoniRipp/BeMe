/**
 * Storage service — AWS S3 pre-signed URL generation.
 *
 * Frontend uploads directly to S3 (no server bandwidth used).
 * Pattern: client requests a signed URL → uploads directly to S3 → stores the public URL.
 *
 * Requires env vars: AWS_REGION, AWS_S3_BUCKET, plus AWS credentials
 * (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, or instance role).
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { ValidationError } from '../errors.js';

const PRESIGNED_URL_EXPIRES_SECONDS = 300; // 5 minutes

function getS3Client() {
  if (!config.awsRegion || !config.awsS3Bucket) {
    throw new Error('AWS_REGION and AWS_S3_BUCKET must be configured for file uploads');
  }
  return new S3Client({ region: config.awsRegion });
}

/** Allowed MIME types for uploads */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

/**
 * Generate a pre-signed S3 PUT URL for a user file upload.
 * @param {string} userId
 * @param {string} mimeType - e.g. 'image/jpeg'
 * @param {'avatar'|'workout'|'food'} context - Where the file belongs
 * @returns {Promise<{ uploadUrl: string, fileUrl: string, key: string }>}
 */
export async function createPresignedUploadUrl(userId: string, mimeType: string, context: string = 'avatar') {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new ValidationError(`Unsupported file type: ${mimeType}. Allowed: JPEG, PNG, WebP, GIF, MP4, QuickTime, WebM`);
  }

  const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const key = `users/${userId}/${context}/${uniqueId}.${ext}`;

  const s3 = getS3Client();
  const command = new PutObjectCommand({
    Bucket: config.awsS3Bucket,
    Key: key,
    ContentType: mimeType,
    // Files are stored private by default — serve through signed GET URLs or CloudFront
    CacheControl: 'max-age=31536000',
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: PRESIGNED_URL_EXPIRES_SECONDS });
  const fileUrl = `https://${config.awsS3Bucket}.s3.${config.awsRegion}.amazonaws.com/${key}`;

  return { uploadUrl, fileUrl, key };
}

/**
 * Delete a file from S3 by its key.
 * @param {string} key
 */
export async function deleteFile(key: string) {
  const s3 = getS3Client();
  await s3.send(new DeleteObjectCommand({ Bucket: config.awsS3Bucket, Key: key }));
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'user-1', email: 'user@test.com', role: 'user' };
    next();
  },
}));

// vi.mock factories are hoisted above const declarations — vi.hoisted keeps
// this initialized before the config factory dereferences it.
const mockConfig = vi.hoisted(() => ({ awsRegion: 'us-east-1', awsS3Bucket: 'test-bucket' }));
vi.mock('../config/index.js', () => ({
  config: mockConfig,
}));

const mockCreatePresignedUploadUrl = vi.fn();
vi.mock('../services/storage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/storage.js')>();
  return {
    ...actual,
    createPresignedUploadUrl: (...args) => mockCreatePresignedUploadUrl(...args),
  };
});

import uploadsRouter from '../routes/uploads.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(uploadsRouter);
  return app;
}

describe('POST /api/uploads/presigned-url', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.awsRegion = 'us-east-1';
    mockConfig.awsS3Bucket = 'test-bucket';
    app = createApp();
  });

  it('returns 503 when S3 is not configured', async () => {
    mockConfig.awsS3Bucket = '';
    const res = await request(app)
      .post('/api/uploads/presigned-url')
      .send({ mimeType: 'image/png' })
      .expect(503);
    expect(res.body.error.message).toContain('not configured');
  });

  it('returns 400 when mimeType is missing', async () => {
    const res = await request(app)
      .post('/api/uploads/presigned-url')
      .send({})
      .expect(400);
    expect(res.body.error.message).toBe('mimeType is required');
    expect(mockCreatePresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('returns 400 for an unknown context', async () => {
    const res = await request(app)
      .post('/api/uploads/presigned-url')
      .send({ mimeType: 'image/png', context: 'malware' })
      .expect(400);
    expect(res.body.error.message).toContain('context must be one of');
  });

  it('rejects video uploads for image contexts', async () => {
    const res = await request(app)
      .post('/api/uploads/presigned-url')
      .send({ mimeType: 'video/mp4', context: 'food' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Unsupported file type for food');
    expect(mockCreatePresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects image uploads for the exercise-video context', async () => {
    await request(app)
      .post('/api/uploads/presigned-url')
      .send({ mimeType: 'image/png', context: 'exercise-video' })
      .expect(400);
    expect(mockCreatePresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('issues a presigned URL for an allowed image type', async () => {
    mockCreatePresignedUploadUrl.mockResolvedValueOnce({
      uploadUrl: 'https://s3/upload',
      fileUrl: 'https://s3/file.png',
      key: 'users/user-1/workout/abc.png',
    });

    const res = await request(app)
      .post('/api/uploads/presigned-url')
      .send({ mimeType: 'image/png', context: 'workout' })
      .expect(200);

    expect(res.body).toEqual({
      uploadUrl: 'https://s3/upload',
      fileUrl: 'https://s3/file.png',
      key: 'users/user-1/workout/abc.png',
      expiresIn: 300,
    });
    expect(mockCreatePresignedUploadUrl).toHaveBeenCalledWith('user-1', 'image/png', 'workout');
  });

  it('issues a presigned URL for an allowed video type in exercise-video', async () => {
    mockCreatePresignedUploadUrl.mockResolvedValueOnce({
      uploadUrl: 'u', fileUrl: 'f', key: 'k',
    });

    await request(app)
      .post('/api/uploads/presigned-url')
      .send({ mimeType: 'video/mp4', context: 'exercise-video' })
      .expect(200);

    expect(mockCreatePresignedUploadUrl).toHaveBeenCalledWith('user-1', 'video/mp4', 'exercise-video');
  });

  it('defaults to the avatar context', async () => {
    mockCreatePresignedUploadUrl.mockResolvedValueOnce({ uploadUrl: 'u', fileUrl: 'f', key: 'k' });

    await request(app)
      .post('/api/uploads/presigned-url')
      .send({ mimeType: 'image/jpeg' })
      .expect(200);

    expect(mockCreatePresignedUploadUrl).toHaveBeenCalledWith('user-1', 'image/jpeg', 'avatar');
  });
});

// Storage abstraction — frontend code never sees this layer.
// Default driver: local disk (./uploads, served at /uploads/*).
// Production driver: S3-compatible (Cloudflare R2, AWS S3, B2, etc.).

import path from 'node:path';
import fs from 'node:fs';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env.js';

export interface StoredFile {
  key: string;        // unique identifier (filename for local, object key for s3)
  url: string;        // browser-accessible URL
  size: number;
  contentType: string;
}

export interface Storage {
  put(opts: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  /**
   * Returns a short-lived signed URL for private reads.
   * Local driver returns the public /uploads/<key> URL (no signing).
   */
  signedUrl(key: string, expiresInSec?: number): Promise<string>;
}

// ── Local driver ────────────────────────────────────────────────────

class LocalStorage implements Storage {
  private uploadDir: string;
  constructor(uploadDir: string) {
    this.uploadDir = uploadDir;
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  }
  async put({ key, body, contentType }: { key: string; body: Buffer; contentType: string }) {
    const filePath = path.join(this.uploadDir, key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, body);
    return {
      key,
      url: `/uploads/${key}`,
      size: body.length,
      contentType,
    };
  }
  async delete(key: string) {
    const filePath = path.join(this.uploadDir, key);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  async signedUrl(key: string) {
    return `/uploads/${key}`;
  }
}

// ── S3 driver (works with Cloudflare R2, AWS S3, B2, MinIO) ────────

class S3Storage implements Storage {
  private client: S3Client;
  private bucket: string;
  private publicBase: string;

  constructor() {
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
    this.bucket = env.S3_BUCKET;
    this.publicBase = env.S3_PUBLIC_BASE_URL.replace(/\/+$/, '');
  }

  async put({ key, body, contentType }: { key: string; body: Buffer; contentType: string }) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    const url = this.publicBase
      ? `${this.publicBase}/${key}`
      : await this.signedUrl(key, 60 * 60 * 24 * 7);
    return { key, url, size: body.length, contentType };
  }

  async delete(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async signedUrl(key: string, expiresInSec = 60 * 60) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSec },
    );
  }
}

// ── Factory ─────────────────────────────────────────────────────────

const uploadDirAbs = path.isAbsolute(env.UPLOAD_DIR)
  ? env.UPLOAD_DIR
  : path.resolve(process.cwd(), env.UPLOAD_DIR);

export const storage: Storage =
  env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage(uploadDirAbs);

export const isS3 = env.STORAGE_DRIVER === 's3';
export const localUploadDir = uploadDirAbs;

import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';

// ============================================================
// Compute hash from buffer — Section 68
// ============================================================

export const computeBufferHash = (buffer: Buffer): string => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

// ============================================================
// ImgBB upload response
// ============================================================

interface ImgBBResponse {
  data: {
    id: string;
    title: string;
    url_viewer: string;
    url: string;
    display_url: string;
    width: string;
    height: string;
    size: string;
    time: string;
    expiration: string;
    image: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    thumb: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    delete_url: string;
  };
  success: boolean;
  status: number;
}

// ============================================================
// Upload to ImgBB
// ============================================================

interface ImgBBUploadResult {
  url: string;
  displayUrl: string;
  deleteUrl: string;
  id: string;
}

export const uploadToImgBB = async (
  buffer: Buffer,
  filename: string
): Promise<ImgBBUploadResult> => {
  const apiKey = env.IMGBB_API_KEY;

  // ImgBB-তে base64 upload
  const base64Image = buffer.toString('base64');

  // URLSearchParams ব্যবহার (Node 18+ native fetch)
  const formData = new URLSearchParams();
  formData.append('key', apiKey);
  formData.append('image', base64Image);
  formData.append('name', filename);

  try {
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      throw new AppError(`ImgBB upload failed: HTTP ${response.status}`, 500, 'IMGBB_HTTP_ERROR');
    }

    const json = (await response.json()) as ImgBBResponse;

    if (!json.success || !json.data) {
      throw new AppError('ImgBB upload failed', 500, 'IMGBB_UPLOAD_FAILED');
    }

    return {
      url: json.data.url,
      displayUrl: json.data.display_url,
      deleteUrl: json.data.delete_url,
      id: json.data.id,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error('ImgBB error:', err);
    throw new AppError('ImgBB upload failed', 500, 'IMGBB_ERROR');
  }
};

// ============================================================
// Delete from ImgBB (Section 15 — privileged cleanup)
// ============================================================

export const deleteFromImgBB = async (deleteUrl: string): Promise<void> => {
  try {
    await fetch(deleteUrl, { method: 'GET' });
  } catch (err) {
    // Silent fail — log করতে পারো
    console.error('ImgBB delete failed:', deleteUrl, err);
  }
};

import sharp from 'sharp';

// ============================================================
// Section 15 — Face Blur Pipeline (Buffer-based)
//
// NOTE: Real face detection এখানে নেই।
// Placeholder: পুরো image-এ Gaussian blur apply করা হয়।
// ভবিষ্যতে face-api.js / Google Vision যোগ করা যাবে।
// ============================================================

export const blurImageBuffer = async (inputBuffer: Buffer): Promise<Buffer> => {
  return sharp(inputBuffer)
    .blur(15) // placeholder face blur
    .toFormat('jpeg', { quality: 85 })
    .toBuffer();
};

// ============================================================
// Resize (optional)
// ============================================================

export const resizeImageBuffer = async (inputBuffer: Buffer, width = 1200): Promise<Buffer> => {
  return sharp(inputBuffer)
    .resize({ width, withoutEnlargement: true })
    .toFormat('jpeg', { quality: 85 })
    .toBuffer();
};

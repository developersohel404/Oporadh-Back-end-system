import { prisma } from '../../config/database.js';
import { isImage } from '../../config/upload.js';
import { blurImageBuffer } from '../../lib/image-processing.js';
import { computeBufferHash, deleteFromImgBB, uploadToImgBB } from '../../lib/storage.js';
import { AppError } from '../../middleware/error.js';

// ============================================================
// UPLOAD MEDIA — ImgBB
// ============================================================

interface UploadMediaParams {
  reportId: string;
  userId: string;
  file: Express.Multer.File;
}

export const uploadMedia = async ({ reportId, userId, file }: UploadMediaParams) => {
  // 1. Report + owner check
  const report = await prisma.crimeReport.findUnique({
    where: { id: reportId },
    select: { id: true, reporterId: true, status: true },
  });

  if (!report) {
    throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
  }
  if (report.reporterId !== userId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  const editableStatuses = ['SUBMITTED', 'NEED_MORE_INFO', 'DRAFT'];
  if (!editableStatuses.includes(report.status)) {
    throw new AppError(`Cannot add media in ${report.status} state`, 400, 'NOT_EDITABLE');
  }

  // 2. Image check — octet-stream + extension
  if (!isImage(file.mimetype)) {
    throw new AppError('Only images allowed (jpg, jpeg, png, webp)', 400, 'INVALID_TYPE');
  }

  // 3. Hash — Section 68
  const fileHash = computeBufferHash(file.buffer);

  // 4. Upload original to ImgBB
  const originalUpload = await uploadToImgBB(
    file.buffer,
    `original_${Date.now()}_${file.originalname}`
  );

  // 5. Blur + Upload processed
  let processedUpload: { url: string; deleteUrl: string } | null = null;
  try {
    const blurredBuffer = await blurImageBuffer(file.buffer);
    const result = await uploadToImgBB(
      blurredBuffer,
      `processed_${Date.now()}_${file.originalname}.jpg`
    );
    processedUpload = {
      url: result.url,
      deleteUrl: result.deleteUrl,
    };
  } catch (err) {
    // Blur upload fail হলে original delete করে দাও
    await deleteFromImgBB(originalUpload.deleteUrl);
    throw err;
  }

  // 6. DB save
  const media = await prisma.reportMedia.create({
    data: {
      reportId,
      originalUrl: originalUpload.url,
      processedUrl: processedUpload.url,
      originalDeleteUrl: originalUpload.deleteUrl,
      processedDeleteUrl: processedUpload.deleteUrl,
      mediaType: 'IMAGE',
      mimeType: file.mimetype,
      fileSize: file.size,
      fileHash,
    },
    select: {
      id: true,
      originalUrl: true,
      processedUrl: true,
      mediaType: true,
      mimeType: true,
      fileSize: true,
      uploadedAt: true,
      // deleteUrl response-এ যাবে না (Section 15)
    },
  });

  return media;
};

// ============================================================
// LIST MEDIA for a report — public view (blurred only)
// ============================================================

export const listReportMedia = async (reportId: string, userId: string) => {
  const report = await prisma.crimeReport.findUnique({
    where: { id: reportId },
    select: { id: true, reporterId: true, status: true },
  });

  if (!report) {
    throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');
  }

  const isOwner = report.reporterId === userId;
  const isPublished = report.status === 'PUBLISHED';

  if (!isOwner && !isPublished) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  const media = await prisma.reportMedia.findMany({
    where: { reportId },
    orderBy: { uploadedAt: 'asc' },
    select: {
      id: true,
      processedUrl: true,
      mediaType: true,
      mimeType: true,
      fileSize: true,
      uploadedAt: true,
      // originalUrl ও delete URLs কখনো public response-এ না
    },
  });

  return media;
};

// ============================================================
// GET original media URL — privileged (MODERATOR/ADMIN)
// ============================================================

export const getOriginalMediaUrl = async (mediaId: string) => {
  const media = await prisma.reportMedia.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      originalUrl: true,
      mediaType: true,
      mimeType: true,
      fileSize: true,
      fileHash: true,
      uploadedAt: true,
    },
  });

  if (!media) {
    throw new AppError('Media not found', 404, 'MEDIA_NOT_FOUND');
  }

  return media;
};

// ============================================================
// DELETE MEDIA — ImgBB + DB
// ============================================================

export const deleteMedia = async (reportId: string, mediaId: string, userId: string) => {
  const media = await prisma.reportMedia.findUnique({
    where: { id: mediaId },
    include: {
      report: { select: { reporterId: true, status: true } },
    },
  });

  if (!media) {
    throw new AppError('Media not found', 404, 'MEDIA_NOT_FOUND');
  }
  if (media.reportId !== reportId) {
    throw new AppError('Media does not belong to this report', 400, 'MISMATCH');
  }
  if (media.report.reporterId !== userId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  const editableStatuses = ['SUBMITTED', 'NEED_MORE_INFO', 'DRAFT'];
  if (!editableStatuses.includes(media.report.status)) {
    throw new AppError('Cannot delete media in this state', 400, 'NOT_EDITABLE');
  }

  // ImgBB থেকে delete
  if (media.originalDeleteUrl) {
    await deleteFromImgBB(media.originalDeleteUrl);
  }
  if (media.processedDeleteUrl) {
    await deleteFromImgBB(media.processedDeleteUrl);
  }

  // DB থেকে delete
  await prisma.reportMedia.delete({ where: { id: mediaId } });

  return { message: 'Media deleted' };
};

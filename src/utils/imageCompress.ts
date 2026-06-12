/**
 * 图片压缩工具 — 在发送给 AI 前压缩图片，避免超出 API body 大小限制
 */

const MAX_DIMENSION = 1024;  // 最大宽/高（像素）
const JPEG_QUALITY = 0.8;    // JPEG 压缩质量
const MAX_SIZE_KB = 500;     // 目标最大文件大小（KB）

/**
 * 将图片 File/base64 压缩为适合 API 发送的 base64 data URI
 * - 限制最大尺寸为 1024px
 * - 转为 JPEG 格式，质量 0.8
 * - 如果仍然超过 500KB，继续降低质量
 */
export async function compressImageForApi(source: File | string): Promise<string> {
  const img = await loadImage(source);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // 计算缩放后的尺寸
  let { width, height } = img;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  // 先用默认质量压缩
  let quality = JPEG_QUALITY;
  let blob = await canvasToBlob(canvas, 'image/jpeg', quality);

  // 如果还太大，逐步降低质量
  while (blob.size > MAX_SIZE_KB * 1024 && quality > 0.3) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }

  return blobToDataUri(blob);
}

/** 加载图片（支持 File 和 base64 string） */
function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src); // 清理 blob URL
      resolve(img);
    };
    img.onerror = reject;

    if (typeof source === 'string') {
      img.src = source; // base64 data URI
    } else {
      img.src = URL.createObjectURL(source); // File → blob URL
    }
  });
}

/** canvas → Blob */
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      type,
      quality,
    );
  });
}

/** Blob → base64 data URI */
function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

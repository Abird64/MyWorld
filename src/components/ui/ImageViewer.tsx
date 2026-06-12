import { useCallback } from 'react';
import { X, Download } from 'lucide-react';

interface ImageViewerProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

/**
 * 全屏图片查看器 — 支持点击关闭和下载
 * src 为 null 时不渲染
 */
export function ImageViewer({ src, alt, onClose }: ImageViewerProps) {
  const handleDownload = useCallback(() => {
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = alt || 'image.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [src, alt]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      {/* 顶部操作栏 */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-end gap-2 p-4 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/80 hover:text-white transition-colors"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          <Download size={16} />
          下载
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex items-center justify-center w-8 h-8 rounded-full text-white/80 hover:text-white transition-colors"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* 图片 */}
      <img
        src={src}
        alt={alt || '查看图片'}
        className="max-w-[92vw] max-h-[85vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

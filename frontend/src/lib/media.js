import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const kindOf = (name = '', type = '') => {
  if (type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(name)) return 'image';
  if (type.startsWith('video/') || /\.(mp4|webm|ogg|mov|m4v)$/i.test(name)) return 'video';
  return 'file';
};
export const formatSize = (bytes) => {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/** Drop validation shared by every picker; returns the files that may be queued. */
export const acceptFiles = (list) => Array.from(list).filter((f) => {
  if (f.size > MAX_FILE_BYTES) { toast.error(`${f.name} is larger than 100 MB`); return false; }
  return true;
});

/** Lets users paste screenshots straight from the clipboard while `enabled`. */
export function usePasteFiles(onFiles, enabled = true) {
  const ref = useRef(onFiles);
  useEffect(() => { ref.current = onFiles; });
  useEffect(() => {
    if (!enabled) return undefined;
    const onPaste = (e) => {
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length) { e.preventDefault(); ref.current(files.map((f, i) => (f.name === 'image.png' ? new File([f], `screenshot-${Date.now()}-${i}.png`, { type: f.type }) : f))); }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [enabled]);
}


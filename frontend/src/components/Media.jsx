import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, File as FileIcon, Film, Play, Trash2, Upload, X } from 'lucide-react';
import { fileUrl } from '../lib/utils';
import { acceptFiles, formatSize, kindOf, usePasteFiles } from '../lib/media';

/** Thumbnail for a local File, with its object URL revoked on unmount. */
const LocalThumb = ({ file }) => {
  const kind = kindOf(file.name, file.type);
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (kind === 'file') return undefined;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, kind]);
  if (kind !== 'file' && !url) return <span className="thumb thumb--icon" />;
  if (kind === 'image') return <img className="thumb" src={url} alt="" />;
  if (kind === 'video') return <span className="thumb thumb--icon"><video src={`${url}#t=0.1`} muted preload="metadata" /><Play size={16} /></span>;
  return <span className="thumb thumb--icon"><FileIcon size={22} /></span>;
};

/**
 * Drop / browse / paste zone. `items` are { file, progress?, error? } entries the parent owns,
 * so the same component serves "queue before create" and "upload immediately".
 */
export const MediaPicker = ({ items, onAdd, onRemove, disabled, compact }) => {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const add = (list) => { const ok = acceptFiles(list); if (ok.length) onAdd(ok); };
  usePasteFiles(add, !disabled);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <button type="button" className={`dropzone ${compact ? 'dropzone--compact' : ''}`} data-over={over} disabled={disabled}
        onClick={() => input.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
        <Upload size={20} />
        <span><b>Drop</b>, <b>browse</b> or <b>paste</b> screenshots and screen recordings</span>
        <span className="hint">Select as many images and videos as you need — up to 100 MB each</span>
      </button>
      <input ref={input} type="file" multiple hidden accept="image/*,video/*,.pdf,.txt,.log,.json,.zip,.csv" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      {items.length > 0 && (
        <div className="queue">
          {items.map((it, i) => (
            <div key={`${it.file.name}-${it.file.size}-${i}`} className="queue__item">
              <LocalThumb file={it.file} />
              <div className="queue__meta">
                <span className="truncate" title={it.file.name}>{it.file.name}</span>
                <span className="muted" style={{ fontSize: 12 }}>{formatSize(it.file.size)}{it.error ? <b style={{ color: 'var(--danger)' }}> · {it.error}</b> : null}</span>
                {it.progress != null && !it.error && <span className="progress"><i style={{ width: `${it.progress}%` }} /></span>}
              </div>
              {!disabled && <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Remove ${it.file.name}`} onClick={() => onRemove(i)}><X size={14} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Full-screen viewer for a list of media with keyboard navigation. */
const Lightbox = ({ items, index, onClose, onIndex }) => {
  const item = items[index];
  const go = useCallback((d) => onIndex((index + d + items.length) % items.length), [index, items.length, onIndex]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [go, onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Media viewer" onClick={onClose}>
      <div className="lightbox__bar" onClick={(e) => e.stopPropagation()}>
        <span className="truncate">{item.name} <span style={{ opacity: .7 }}>· {index + 1} / {items.length}</span></span>
        <a className="btn btn--ghost btn--icon" href={item.url} download aria-label="Download"><Download size={18} /></a>
        <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close"><X size={20} /></button>
      </div>
      {items.length > 1 && <button className="lightbox__nav lightbox__nav--prev" aria-label="Previous" onClick={(e) => { e.stopPropagation(); go(-1); }}><ChevronLeft size={28} /></button>}
      <div className="lightbox__stage" onClick={(e) => e.stopPropagation()}>
        {item.kind === 'video'
          ? <video key={item.url} src={item.url} controls autoPlay />
          : <img key={item.url} src={item.url} alt={item.name} />}
      </div>
      {items.length > 1 && <button className="lightbox__nav lightbox__nav--next" aria-label="Next" onClick={(e) => { e.stopPropagation(); go(1); }}><ChevronRight size={28} /></button>}
    </div>
  );
};

/** Grid of a bug's attachments: image and video tiles open in a viewer, other files download. */
export const AttachmentGallery = ({ attachments, canDelete, onDelete }) => {
  const [open, setOpen] = useState(null);
  const media = useMemo(() => attachments
    .map((a) => ({ id: a.id, name: a.filename, url: fileUrl(a.file), kind: kindOf(a.filename) }))
    .filter((m) => m.kind !== 'file'), [attachments]);

  return (
    <>
      <div className="gallery">
        {attachments.map((a) => {
          const url = fileUrl(a.file);
          const kind = kindOf(a.filename);
          const mi = media.findIndex((m) => m.id === a.id);
          return (
            <figure key={a.id} className="tile">
              {kind === 'file' ? (
                <a className="tile__media tile__media--file" href={url} download><FileIcon size={30} /><span>{a.filename.split('.').pop()?.toUpperCase()}</span></a>
              ) : (
                <button type="button" className="tile__media" onClick={() => setOpen(mi)} aria-label={`Open ${a.filename}`}>
                  {kind === 'image' ? <img src={url} alt="" loading="lazy" /> : <><video src={`${url}#t=0.1`} preload="metadata" muted /><span className="tile__play"><Play size={20} /></span></>}
                </button>
              )}
              <figcaption>
                <span className="truncate" title={a.filename}>{kind === 'video' && <Film size={12} style={{ verticalAlign: -1, marginRight: 4 }} />}{a.filename}</span>
                <span className="tile__actions">
                  <a className="btn btn--ghost btn--icon btn--sm" href={url} download aria-label={`Download ${a.filename}`}><Download size={14} /></a>
                  {canDelete(a) && <button className="btn btn--ghost btn--icon btn--sm" aria-label={`Remove ${a.filename}`} onClick={() => onDelete(a)}><Trash2 size={14} /></button>}
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>
      {open != null && media[open] && <Lightbox items={media} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
};

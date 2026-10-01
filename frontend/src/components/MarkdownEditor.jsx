import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bold, Italic, Code, Link as LinkIcon, List, Quote, FileCode } from 'lucide-react';

export const Markdown = ({ children }) => (
  <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ''}</ReactMarkdown></div>
);

const MarkdownEditor = ({ value, onChange, placeholder = '', rows = 6, id }) => {
  const ref = useRef(null);
  const [preview, setPreview] = useState(false);

  const wrap = (before, after = '', placeholderText = 'text') => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = value.slice(start, end) || placeholderText;
    onChange(`${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };
  const linePrefix = (prefix) => {
    const el = ref.current;
    if (!el) return;
    const start = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    onChange(`${value.slice(0, start)}${prefix}${value.slice(start)}`);
    requestAnimationFrame(() => el.focus());
  };

  const tools = [
    ['Bold', Bold, () => wrap('**', '**')],
    ['Italic', Italic, () => wrap('*', '*')],
    ['Bulleted list', List, () => linePrefix('- ')],
    ['Quote', Quote, () => linePrefix('> ')],
    ['Inline code', Code, () => wrap('`', '`', 'code')],
    ['Code block', FileCode, () => wrap('```\n', '\n```', 'code')],
    ['Link', LinkIcon, () => wrap('[', '](https://)', 'link text')],
  ];

  return (
    <div className="md-editor">
      <div className="md-editor__bar">
        {tools.map(([label, Icon, run]) => (
          <button key={label} type="button" className="btn btn--ghost btn--icon btn--sm" title={label} aria-label={label} onClick={run} disabled={preview}>
            <Icon size={15} />
          </button>
        ))}
        <div className="segmented">
          <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Write</button>
          <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>Preview</button>
        </div>
      </div>
      {preview ? (
        <div className="md-editor__preview">
          {value.trim() ? <Markdown>{value}</Markdown> : <span className="muted">Nothing to preview</span>}
        </div>
      ) : (
        <textarea id={id} ref={ref} value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
};

export default MarkdownEditor;

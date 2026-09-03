import React from 'react';
import { Bold, Italic, Code, Link as LinkIcon, List, Quote } from 'lucide-react';

const MarkdownEditor = ({ value, onChange, placeholder = '', minHeight = '150px' }) => {
  
  const insertText = (prefix, suffix = '') => {
    const textarea = document.activeElement;
    if (!textarea || textarea.tagName !== 'TEXTAREA') return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);
    
    const newValue = `${before}${prefix}${selected}${suffix}${after}`;
    onChange(newValue);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const toolbarStyle = {
    display: 'flex', gap: '4px', padding: '8px', 
    backgroundColor: 'var(--bg-surface)', 
    border: '1px solid var(--border)', 
    borderBottom: 'none',
    borderTopLeftRadius: 'var(--radius-md)', 
    borderTopRightRadius: 'var(--radius-md)'
  };
  
  const btnStyle = {
    background: 'transparent', border: 'none', 
    color: 'var(--text-secondary)', padding: '4px', 
    cursor: 'pointer', borderRadius: '4px',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }} onMouseDown={(e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            e.preventDefault();
        }
    }}>
      <div style={toolbarStyle}>
        <button type="button" onClick={() => insertText('**', '**')} style={btnStyle} title="Bold"><Bold size={16} /></button>
        <button type="button" onClick={() => insertText('*', '*')} style={btnStyle} title="Italic"><Italic size={16} /></button>
        <div style={{ width: '1px', backgroundColor: 'var(--border)', margin: '0 4px' }} />
        <button type="button" onClick={() => insertText('- ')} style={btnStyle} title="List"><List size={16} /></button>
        <button type="button" onClick={() => insertText('> ')} style={btnStyle} title="Quote"><Quote size={16} /></button>
        <div style={{ width: '1px', backgroundColor: 'var(--border)', margin: '0 4px' }} />
        <button type="button" onClick={() => insertText('`', '`')} style={btnStyle} title="Inline Code"><Code size={16} /></button>
        <button type="button" onClick={() => insertText('```\n', '\n```')} style={btnStyle} title="Code Block"><Code size={16} /></button>
        <button type="button" onClick={() => insertText('[', '](url)')} style={btnStyle} title="Link"><LinkIcon size={16} /></button>
      </div>
      <textarea
        className="form-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ 
          minHeight, 
          borderTopLeftRadius: 0, 
          borderTopRightRadius: 0,
          fontFamily: "'SF Mono', 'Cascadia Code', monospace",
          fontSize: '0.9rem'
        }}
      />
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
        Markdown is supported
      </div>
    </div>
  );
};

export default MarkdownEditor;

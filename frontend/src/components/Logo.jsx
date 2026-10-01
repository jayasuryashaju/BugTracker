export const LogoMark = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect width="64" height="64" rx="15" fill="#4f46e5" />
    <path d="M32 11 47 18v15c0 9.5-6.4 17-15 20-8.6-3-15-10.5-15-20V18Z" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
    <circle cx="32" cy="31" r="7" stroke="#c7c3fb" strokeWidth="2.5" />
    <circle cx="32" cy="31" r="2.5" fill="#fff" />
  </svg>
);

const Logo = ({ size = 'md', subtitle, light }) => {
  const dims = { sm: [28, 15], md: [32, 16], lg: [40, 20] }[size];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0, color: light ? '#fff' : 'var(--text)' }}>
      <LogoMark size={dims[0]} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: dims[1], letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
          BugTracker <span style={{ color: light ? '#c7c3fb' : 'var(--accent-text)' }}>Pro</span>
        </span>
        {subtitle && <span className="truncate" style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{subtitle}</span>}
      </span>
    </span>
  );
};

export default Logo;

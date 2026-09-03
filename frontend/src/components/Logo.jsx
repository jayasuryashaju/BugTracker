import React from 'react';

/**
 * BugTracker Pro Logo
 * Abstract shield + crosshair target mark — conveys precision issue tracking
 * without any literal bug/insect imagery.
 */

const LogoIcon = ({ size = 36 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0 }}
  >
    <defs>
      <linearGradient id="logoBg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#4338ca" />
      </linearGradient>
    </defs>
    {/* Rounded square */}
    <rect width="64" height="64" rx="14" fill="url(#logoBg)" />
    {/* Shield */}
    <path
      d="M32 10 L48 18 L48 34 C48 44 41 52 32 56 C23 52 16 44 16 34 L16 18 Z"
      fill="none"
      stroke="#fff"
      strokeWidth="2.5"
      opacity="0.9"
    />
    {/* Target ring */}
    <circle cx="32" cy="32" r="8" fill="none" stroke="#a5b4fc" strokeWidth="2" opacity="0.8" />
    {/* Crosshairs */}
    <line x1="32" y1="22" x2="32" y2="28" stroke="#a5b4fc" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
    <line x1="32" y1="36" x2="32" y2="42" stroke="#a5b4fc" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
    <line x1="22" y1="32" x2="28" y2="32" stroke="#a5b4fc" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
    <line x1="36" y1="32" x2="42" y2="32" stroke="#a5b4fc" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
    {/* Center dot */}
    <circle cx="32" cy="32" r="2.5" fill="#fff" />
  </svg>
);

const Logo = ({ size = 'md', showText = true, subtitle = null, className = '' }) => {
  const sizeMap = {
    sm: { icon: 30, name: '0.95rem', badge: '0.55rem', gap: '8px' },
    md: { icon: 36, name: '1.1rem', badge: '0.6rem', gap: '10px' },
    lg: { icon: 44, name: '1.35rem', badge: '0.65rem', gap: '12px' },
  };
  const s = sizeMap[size] || sizeMap.md;

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        textDecoration: 'none',
      }}
    >
      <LogoIcon size={s.icon} />

      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: s.name,
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              BugTracker
            </span>
            <span
              style={{
                fontSize: s.badge,
                fontWeight: 700,
                padding: '1.5px 5px',
                borderRadius: '4px',
                background: '#4f46e5',
                color: '#fff',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                lineHeight: 1.4,
              }}
            >
              Pro
            </span>
          </div>

          {subtitle && (
            <span
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                fontWeight: 500,
                marginTop: '1px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;

import { Link } from 'react-router-dom';

export function Logo({ compact = false, to = '/' }: { compact?: boolean; to?: string }) {
  return (
    <Link to={to} className={`logo ${compact ? 'logo--compact' : ''}`} aria-label="Ludo ANSARY home">
      <span className="logo__mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" width="100%" height="100%">
          <rect width="40" height="40" rx="11" fill="#ffffff" />
          <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="10.25" fill="none" stroke="#c9dbf3" strokeWidth="1.5" />
          <rect x="5" y="5" width="13" height="13" rx="3.5" fill="#e8433c" />
          <rect x="22" y="5" width="13" height="13" rx="3.5" fill="#21a44f" />
          <rect x="5" y="22" width="13" height="13" rx="3.5" fill="#2f74e0" />
          <rect x="22" y="22" width="13" height="13" rx="3.5" fill="#f2b705" />
          <path d="M20 13.6 25.4 20 20 26.4 14.6 20Z" fill="#17263c" />
          <circle cx="20" cy="20" r="3.1" fill="#ffffff" />
        </svg>
      </span>
      <span className="logo__text">
        <span className="logo__title">Ludo</span>
        {!compact && <span className="logo__sub">Ansary</span>}
      </span>
    </Link>
  );
}

import { Link } from 'react-router-dom';

export function Logo({ compact = false, to = '/' }: { compact?: boolean; to?: string }) {
  return (
    <Link to={to} className={`logo ${compact ? 'logo--compact' : ''}`} aria-label="Ludo ANSARY home">
      <span className="logo__mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" width="100%" height="100%">
          <rect width="40" height="40" rx="11" fill="#0d1a28" />
          <rect x="5" y="5" width="13" height="13" rx="3.5" fill="#e0524b" />
          <rect x="22" y="5" width="13" height="13" rx="3.5" fill="#3aa96b" />
          <rect x="5" y="22" width="13" height="13" rx="3.5" fill="#4585dd" />
          <rect x="22" y="22" width="13" height="13" rx="3.5" fill="#efb02d" />
          <circle cx="20" cy="20" r="5" fill="#f7e3b4" />
          <circle cx="20" cy="20" r="2.1" fill="#0d1a28" />
        </svg>
      </span>
      <span className="logo__text">
        <span className="logo__title">Ludo</span>
        {!compact && <span className="logo__sub">Ansary</span>}
      </span>
    </Link>
  );
}
